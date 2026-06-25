import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Palette, Sparkles, ArrowLeft, Server, BarChart3, Globe, Wrench, UserCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const themes = [
  { id: 'dark', label: 'Тёмная', color: '#0c0e14' },
  { id: 'midnight', label: 'Midnight', color: '#0a0f1a' },
  { id: 'indigo', label: 'Indigo', color: '#0e0a1a' },
  { id: 'emerald', label: 'Emerald', color: '#0a1a0e' },
  { id: 'crimson', label: 'Crimson', color: '#1a0a0e' },
  { id: 'graphite', label: 'Graphite', color: '#141414' },
];

const animations = [
  { id: 'off', label: 'Выкл' },
  { id: 'soft', label: 'Мягкие' },
  { id: 'full', label: 'Полные' },
];

const scrollModes = [
  { id: 'off', label: 'Выкл' },
  { id: 'standard', label: 'Стандарт' },
  { id: 'smooth', label: 'Плавный' },
];

type TabId = 'server' | 'analytics' | 'site' | 'tech';

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'server', label: 'Сервер', icon: Server },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'site', label: 'Сайт', icon: Globe },
  { id: 'tech', label: 'Тех', icon: Wrench },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [anim, setAnim] = useState('full');
  const [scroll, setScroll] = useState('standard');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('site');
  const [openPanels, setOpenPanels] = useState({ theme: true, anim: true, scroll: true });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fearviewer_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.anim) setAnim(parsed.anim);
        if (parsed.scroll) setScroll(parsed.scroll);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-anim', anim);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.scrollBehavior = scroll === 'smooth' ? 'smooth' : 'auto';

    const html = document.documentElement;
    const existingThemeClasses = Array.from(html.classList).filter((c) => c.startsWith('theme-'));
    existingThemeClasses.forEach((c) => html.classList.remove(c));
    if (theme !== 'dark') {
      html.classList.add('theme-' + theme);
    }
  }, [theme, anim, scroll]);

  const handleSave = () => {
    localStorage.setItem('fearviewer_settings', JSON.stringify({ theme, anim, scroll }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setTheme('dark');
    setAnim('full');
    setScroll('standard');
    localStorage.removeItem('fearviewer_settings');
  };

  const togglePanel = (key: keyof typeof openPanels) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const userAvatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=64`
    : null;

  const displayName = user?.display_name || user?.username || 'User';

  const tabButtonClass = (id: TabId) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      activeTab === id
        ? 'bg-indigo-500/30 text-indigo-300'
        : 'bg-white/5 text-gray-400 hover:bg-white/10'
    }`;

  return (
    <div className="max-w-[1000px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/players"
            className="w-12 h-12 glass-panel rounded-xl flex items-center justify-center hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft className="text-white text-xl" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Настройки</h1>
            <p className="text-gray-400 text-sm">Персонализация панели и параметры системы</p>
          </div>
        </div>
        <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt={user?.username} className="w-8 h-8 rounded-full" />
          ) : (
            <UserCircle className="w-8 h-8 text-gray-500" />
          )}
          <span className="text-white font-semibold">{displayName}</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={tabButtonClass(tab.id)}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === 'server' && (
          <>
            <section className="glass-panel p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Server className="text-emerald-400 text-xl" />
                </div>
                <h2 className="text-xl font-bold text-white">Активность серверов</h2>
              </div>
              <p className="text-gray-400 text-sm">Статистика онлайна и активности серверов будет доступна позже.</p>
            </section>
            <section className="glass-panel p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <UserCircle className="text-cyan-400 text-xl" />
                </div>
                <h2 className="text-xl font-bold text-white">Staff онлайн</h2>
              </div>
              <p className="text-gray-400 text-sm">Список администраторов на серверах появится в этом разделе.</p>
            </section>
          </>
        )}

        {activeTab === 'analytics' && (
          <section className="glass-panel p-6 rounded-2xl lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-violet-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white">Аналитика стаффа</h2>
            </div>
            <p className="text-gray-400 text-sm">Графики и сводки по активности команды будут добавлены позже.</p>
          </section>
        )}

        {activeTab === 'tech' && (
          <section className="glass-panel p-6 rounded-2xl lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Wrench className="text-amber-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white">Технические настройки</h2>
            </div>
            <p className="text-gray-400 text-sm">Управление техработами и системными параметрами будет доступно позже.</p>
          </section>
        )}

        {activeTab === 'site' && (
          <section className="glass-panel p-6 rounded-2xl lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Settings className="text-amber-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white">Локальные настройки</h2>
            </div>

            <div className="space-y-4">
              {/* Theme */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => togglePanel('theme')}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                      <Palette className="text-indigo-400 text-xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Тема</h3>
                  </div>
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
                    {openPanels.theme ? 'Скрыть' : 'Открыть'}
                  </span>
                </button>
                {openPanels.theme && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {themes.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          className={`local-opt-btn ${theme === t.id ? 'active' : ''}`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-white/20 mr-2"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Animations */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => togglePanel('anim')}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                      <Sparkles className="text-purple-400 text-xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Анимации</h3>
                  </div>
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
                    {openPanels.anim ? 'Скрыть' : 'Открыть'}
                  </span>
                </button>
                {openPanels.anim && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-2">
                      {animations.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAnim(a.id)}
                          className={`local-opt-btn ${anim === a.id ? 'active' : ''}`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scroll */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => togglePanel('scroll')}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                      <Settings className="text-cyan-400 text-xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Плавный скролл</h3>
                  </div>
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
                    {openPanels.scroll ? 'Скрыть' : 'Открыть'}
                  </span>
                </button>
                {openPanels.scroll && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-2">
                      {scrollModes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setScroll(s.id)}
                          className={`local-opt-btn ${scroll === s.id ? 'active' : ''}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-white/[0.06]">
              {saved && <span className="text-sm text-emerald-400">Сохранено</span>}
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-semibold transition-colors"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
              >
                Сохранить
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
