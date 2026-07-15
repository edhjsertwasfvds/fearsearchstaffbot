# BD for Stats Staff

Мини-сервис для синхронизации данных стаффа из Fear API:

- берет список `/admins/`
- для каждого `steamid` запрашивает `/profile/:steamid`
- сохраняет данные в PostgreSQL
- имеет минимальный UI с кнопкой "Обновить данные"
- каждые N минут сам запускает синк (по умолчанию 30)
- при 401/403 от Fear API шлёт уведомление в Telegram и/или Discord

Полный ответ `/profile/:steamid` хранится в PostgreSQL в колонке `profiles.raw_json` (JSONB): это и есть «сырой JSON» — весь объект как отдал API. Отдельные колонки в таблице — для удобного просмотра в UI; второй проект может читать только `raw_json`, если ему нужны все поля.

## Запуск локально

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` по примеру `.env.example`.

3. Запустить:

```bash
npm start
```

Открыть `http://localhost:3000`.

## Переменные окружения

- `DATABASE_URL` - PostgreSQL connection string (Railway Postgres).
- `FEAR_COOKIE` - cookie строка (например `access_token=...`).
- `ACCESS_TOKEN` - если не используешь `FEAR_COOKIE`.
- `PROFILE_CONCURRENCY` - параллелизм запросов профилей.
- `PORT` - порт приложения.
- `AUTO_REFRESH_MINUTES` - интервал авто-синка (0 = выключить).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` - алерт при невалидном токене.
- `DISCORD_WEBHOOK_URL` - тот же алерт в Discord.

## Railway

1. Создай новый проект на Railway, подключи репозиторий.
2. Добавь PostgreSQL plugin/service.
3. В Variables выстави:
   - `DATABASE_URL` — в панели Postgres: **Connect** → скопируй **Database URL** в Variables веб-сервиса (если переменная пустая, приложение уйдёт в рестарт-луп с `Failed to init DB`)
   - `FEAR_COOKIE` или `ACCESS_TOKEN`
   - `PROFILE_CONCURRENCY=5`
   - `AUTO_REFRESH_MINUTES=30`
   - при желании: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`
4. Deploy.

## Второй проект

Практичный вариант: тот же Railway-проект, общий Postgres. Второй сервис подключается к `DATABASE_URL` (лучше отдельный read-only пользователь) и читает таблицы `admins`, `profiles`, при необходимости поле `profiles.raw_json`. Альтернатива без общей БД: второй проект дергает этот сервис по HTTP (`GET /api/admins`) — тогда связь слабее, но проще изолировать.

## API в проекте

- `POST /api/refresh` - запустить обновление.
- `GET /api/refresh-status` - статус последнего обновления.
- `GET /api/admins` - список админов + данные профиля.
- `GET /api/health` - проверка сервиса.
