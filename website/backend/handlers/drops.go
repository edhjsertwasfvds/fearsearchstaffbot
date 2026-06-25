package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"fearstaff-api/config"
	"fearstaff-api/database"
)

// DropsHandler предоставляет API для работы с дропами FearProject.
type DropsHandler struct {
	cfg *config.Config
	db  *database.DB

	client *http.Client

	feedCache   []byte
	feedCacheAt time.Time
	feedCacheMu sync.RWMutex
}

type DropItem struct {
	ID          int64   `json:"id"`
	SteamID     string  `json:"steamid"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	CreatedAt   string  `json:"created_at"`
	Image       string  `json:"image"`
	RarityColor string  `json:"rarity_color"`
}

type DropsLeaderboardPlayer struct {
	SteamID string      `json:"steam_id"`
	Name    string      `json:"name"`
	Avatar  string      `json:"avatar"`
	Count   int         `json:"count"`
	Skins   []DropSkin  `json:"skins"`
}

type DropSkin struct {
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Image string  `json:"image"`
}

func NewDropsHandler(cfg *config.Config, db *database.DB) *DropsHandler {
	return &DropsHandler{
		cfg:    cfg,
		db:     db,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (h *DropsHandler) fearHeaders() http.Header {
	headers := http.Header{}
	headers.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	headers.Set("Accept", "application/json, text/plain, */*")
	headers.Set("Referer", "https://fearproject.ru/")
	headers.Set("Origin", "https://fearproject.ru")
	if h.cfg.FearCookie != "" {
		cleaned := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(h.cfg.FearCookie, "\n", ""), "\r", ""))
		if cleaned != "" {
			headers.Set("Cookie", cleaned)
		}
	}
	return headers
}

func (h *DropsHandler) getDropsFromDB(cutoff time.Time, limit int) ([]DropItem, error) {
	if h.db == nil {
		return nil, fmt.Errorf("no database")
	}
	rows, err := h.db.GetDropsFromDB(cutoff, limit)
	if err != nil {
		return nil, err
	}
	items := make([]DropItem, 0, len(rows))
	for _, r := range rows {
		id, _ := r["id"].(int64)
		price, _ := r["price"].(float64)
		items = append(items, DropItem{
			ID:          id,
			SteamID:     toString(r["steamid"]),
			Name:        toString(r["name"]),
			Price:       price,
			CreatedAt:   toString(r["created_at"]),
			Image:       toString(r["image"]),
			RarityColor: toString(r["rarity_color"]),
		})
	}
	return items, nil
}

func (h *DropsHandler) saveDropToDB(d DropItem) {
	if h.db == nil {
		return
	}
	t := parseDropTime(d.CreatedAt)
	createdAtMs := int64(0)
	if !t.IsZero() {
		createdAtMs = t.UnixMilli()
	}
	raw, _ := json.Marshal(d)
	_ = h.db.SaveDrop(d.ID, d.SteamID, d.Name, d.Price, d.Image, d.RarityColor, "", "", t, createdAtMs, raw)
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h *DropsHandler) fearGet(url string) []byte {
	req, _ := http.NewRequest("GET", url, nil)
	for k, v := range h.fearHeaders() {
		req.Header[k] = v
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}
	var body []byte
	if _, err := resp.Body.Read(body); err != nil {
		// Fallback to ReadAll
	}
	// Use json decoder to read array
	var result []DropItem
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}
	out, _ := json.Marshal(result)
	return out
}

func (h *DropsHandler) fetchFeed() ([]DropItem, error) {
	h.feedCacheMu.RLock()
	cacheValid := h.feedCache != nil && time.Since(h.feedCacheAt) < 60*time.Second
	cacheData := h.feedCache
	h.feedCacheMu.RUnlock()

	if cacheValid {
		var cached []DropItem
		if err := json.Unmarshal(cacheData, &cached); err == nil {
			return cached, nil
		}
	}

	req, _ := http.NewRequest("GET", "https://api.fearproject.ru/drops/feed", nil)
	for k, v := range h.fearHeaders() {
		req.Header[k] = v
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var raw interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	var items []DropItem
	switch v := raw.(type) {
	case []interface{}:
		b, _ := json.Marshal(v)
		json.Unmarshal(b, &items)
	case map[string]interface{}:
		if feed, ok := v["feed"].([]interface{}); ok {
			b, _ := json.Marshal(feed)
			json.Unmarshal(b, &items)
		} else if data, ok := v["data"].([]interface{}); ok {
			b, _ := json.Marshal(data)
			json.Unmarshal(b, &items)
		} else if results, ok := v["results"].([]interface{}); ok {
			b, _ := json.Marshal(results)
			json.Unmarshal(b, &items)
		}
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("unexpected drops feed format")
	}

	out, _ := json.Marshal(items)
	h.feedCacheMu.Lock()
	h.feedCache = out
	h.feedCacheAt = time.Now()
	h.feedCacheMu.Unlock()

	return items, nil
}

func parseDropTime(s string) time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}
	}
	// Попробуем ISO 8601
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05.000Z",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	// Попробуем timestamp
	if unix, err := strconv.ParseInt(s, 10, 64); err == nil {
		if unix > 1e12 {
			return time.UnixMilli(unix)
		}
		return time.Unix(unix, 0)
	}
	return time.Time{}
}

func dropDateString(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02")
}

// GetDrops возвращает список дропов. Query: ?date=YYYY-MM-DD&limit=50&hours=24
func (h *DropsHandler) GetDrops(w http.ResponseWriter, r *http.Request) {
	dateParam := r.URL.Query().Get("date")
	hoursParam := r.URL.Query().Get("hours")
	limitParam := r.URL.Query().Get("limit")

	limit := 50
	if limitParam != "" {
		if n, err := strconv.Atoi(limitParam); err == nil && n > 0 {
			limit = n
		}
	}

	hours := 0
	if hoursParam != "" {
		if n, err := strconv.Atoi(hoursParam); err == nil && n > 0 {
			hours = n
		}
	}

	now := time.Now()
	cutoff := time.Time{}
	if hours > 0 {
		cutoff = now.Add(-time.Duration(hours) * time.Hour)
	}
	if dateParam != "" {
		if t, err := time.Parse("2006-01-02", dateParam); err == nil {
			cutoff = t
		}
	}

	// Сначала пробуем БД (бот пишет сюда дропы)
	source := "db"
	items, err := h.getDropsFromDB(cutoff, limit)
	if err != nil || len(items) == 0 {
		apiItems, apiErr := h.fetchFeed()
		if apiErr != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to fetch drops: %s"}`, apiErr.Error()), http.StatusBadGateway)
			return
		}
		items = apiItems
		source = "api"
		// сохраняем в БД для истории
		for _, d := range items {
			h.saveDropToDB(d)
		}
	}

	filtered := make([]DropItem, 0, len(items))
	for _, d := range items {
		t := parseDropTime(d.CreatedAt)
		if !cutoff.IsZero() && t.Before(cutoff) {
			continue
		}
		if dateParam != "" && dropDateString(t) != dateParam {
			continue
		}
		filtered = append(filtered, d)
	}

	// Сортировка от новых к старым
	sort.Slice(filtered, func(i, j int) bool {
		ti := parseDropTime(filtered[i].CreatedAt)
		tj := parseDropTime(filtered[j].CreatedAt)
		return ti.After(tj)
	})

	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"drops":   filtered,
		"total":   len(filtered),
		"source":  source,
	})
}

type DropsStats struct {
	Date           string  `json:"date"`
	TotalDrops     int     `json:"total_drops"`
	TotalValue     float64 `json:"total_value"`
	UniquePlayers  int     `json:"unique_players"`
	AverageValue   float64 `json:"average_value"`
	MostExpensive  float64 `json:"most_expensive"`
}

// GetDropsStats возвращает статистику дропов за дату (date=YYYY-MM-DD) или сегодня/вчера/7дней.
func (h *DropsHandler) GetDropsStats(w http.ResponseWriter, r *http.Request) {
	dateParam := r.URL.Query().Get("date")
	period := r.URL.Query().Get("period")
	if period == "" && dateParam == "" {
		period = "today"
	}

	now := time.Now()
	start := now.AddDate(0, 0, -14)
	end := now.AddDate(0, 0, 1)
	if dateParam != "" {
		if t, err := time.Parse("2006-01-02", dateParam); err == nil {
			start = t
			end = t.AddDate(0, 0, 1)
		}
	} else {
		switch period {
		case "today":
			start = now.Truncate(24 * time.Hour)
			end = start.AddDate(0, 0, 1)
		case "yesterday":
			start = now.AddDate(0, 0, -1).Truncate(24 * time.Hour)
			end = start.AddDate(0, 0, 1)
		case "7days", "week":
			start = now.AddDate(0, 0, -7)
		}
	}

	var result []map[string]interface{}
	source := "db"
	if h.db != nil {
		rows, err := h.db.GetDropsStatsFromDB(start, end)
		if err == nil && len(rows) > 0 {
			result = rows
		}
	}

	if len(result) == 0 {
		items, err := h.fetchFeed()
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to fetch drops: %s"}`, err.Error()), http.StatusBadGateway)
			return
		}
		source = "api"
		for _, d := range items {
			h.saveDropToDB(d)
		}
		stats := h.buildStatsFromItems(items, period, dateParam, now)
		result = make([]map[string]interface{}, 0, len(stats))
		for _, s := range stats {
			result = append(result, map[string]interface{}{
				"date":           s.Date,
				"total_drops":    s.TotalDrops,
				"total_value":    s.TotalValue,
				"unique_players": s.UniquePlayers,
				"average_value":  s.AverageValue,
				"most_expensive": s.MostExpensive,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   result,
		"source":  source,
	})
}

func (h *DropsHandler) buildStatsFromItems(items []DropItem, period, dateParam string, now time.Time) []DropsStats {
	stats := make(map[string]*DropsStats)

	for _, d := range items {
		t := parseDropTime(d.CreatedAt)
		date := dropDateString(t)
		if date == "" {
			continue
		}
		s, ok := stats[date]
		if !ok {
			s = &DropsStats{Date: date}
			stats[date] = s
		}
		s.TotalDrops++
		s.TotalValue += d.Price
		if d.Price > s.MostExpensive {
			s.MostExpensive = d.Price
		}
	}

	playersByDate := make(map[string]map[string]struct{})
	for _, d := range items {
		t := parseDropTime(d.CreatedAt)
		date := dropDateString(t)
		if date == "" {
			continue
		}
		if playersByDate[date] == nil {
			playersByDate[date] = make(map[string]struct{})
		}
		playersByDate[date][d.SteamID] = struct{}{}
	}
	for date, set := range playersByDate {
		if s, ok := stats[date]; ok {
			s.UniquePlayers = len(set)
			if s.TotalDrops > 0 {
				s.AverageValue = s.TotalValue / float64(s.TotalDrops)
			}
		}
	}

	result := make([]DropsStats, 0)
	today := now.Format("2006-01-02")
	yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")

	if dateParam != "" {
		if s, ok := stats[dateParam]; ok {
			result = append(result, *s)
		}
	} else {
		switch period {
		case "today":
			if s, ok := stats[today]; ok {
				result = append(result, *s)
			}
		case "yesterday":
			if s, ok := stats[yesterday]; ok {
				result = append(result, *s)
			}
		case "7days", "week":
			for i := 0; i < 7; i++ {
				d := now.AddDate(0, 0, -i).Format("2006-01-02")
				if s, ok := stats[d]; ok {
					result = append(result, *s)
				}
			}
		default:
			for i := 0; i < 14; i++ {
				d := now.AddDate(0, 0, -i).Format("2006-01-02")
				if s, ok := stats[d]; ok {
					result = append(result, *s)
				}
			}
		}
	}
	return result
}

// GetDropsServerStats возвращает аналитику дропов по серверам.
func (h *DropsHandler) GetDropsServerStats(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "servers": []interface{}{}})
		return
	}

	hours := 24
	if hParam := r.URL.Query().Get("hours"); hParam != "" {
		if n, err := strconv.Atoi(hParam); err == nil && n > 0 {
			hours = n
		}
	}
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	servers, err := h.db.DropServerStats(since, 20)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "servers": []interface{}{}})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"servers": servers,
	})
}

// GetDropsLeaderboard возвращает таблицу дропов по игрокам.
func (h *DropsHandler) GetDropsLeaderboard(w http.ResponseWriter, r *http.Request) {
	req, _ := http.NewRequest("GET", "https://api.fearproject.ru/leaderboard/drops", nil)
	for k, v := range h.fearHeaders() {
		req.Header[k] = v
	}
	resp, err := h.client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to fetch drops leaderboard: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var data struct {
		Players []DropsLeaderboardPlayer `json:"players"`
		Total   int                      `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"decode error: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"players": data.Players,
		"total":   len(data.Players),
	})
}
