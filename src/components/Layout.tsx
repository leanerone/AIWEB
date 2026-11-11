import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Bot, BookOpen, CheckCheck, Heart, LayoutGrid, LogOut, MessageCircle, Moon, Notebook, Newspaper, Rss, Search, Settings as SettingsIcon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { FloatingAssistant } from './Assistant/FloatingAssistant'
import { useAssistant } from '../stores/assistant'
import { BackToTop } from './BackToTop'
import { CommandPalette } from './CommandPalette'
import { MegaMenu } from './MegaMenu'
import { useLiquidGlass } from '../hooks/useLiquidGlass'
import type { NotificationItem } from '../types'

const NAV = [
  { to: '/', label: '首页', icon: LayoutGrid },
  { to: '/resources', label: '资源库', icon: BookOpen },
  { to: '/news', label: '资讯', icon: Rss },
  { to: '/briefings', label: '简报', icon: Newspaper },
  { to: '/memos', label: '笔记', icon: Notebook },
  { to: '/settings', label: '设置', icon: SettingsIcon },
]

export function Layout() {
  const { user, clear } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // 明亮为默认主题（SkillHub 风）；用户手动切换会记住偏好
  const [dark, setDark] = useState(() => localStorage.getItem('aiweb_theme') === 'dark')
  const [unread, setUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([])
  const notifTimer = useRef<number | undefined>(undefined)
  // 两个下拉都是条件渲染，必须用 enabled 让 effect 在挂载后重跑
  const notifGlassRef = useLiquidGlass<HTMLDivElement>({ radius: 16, level: 'elevated', enabled: notifOpen })
  const menuGlassRef = useLiquidGlass<HTMLDivElement>({ radius: 16, level: 'elevated', enabled: menuOpen })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('aiweb_theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    // Ctrl/⌘+J 全局唤起/收起 AI 助手（与 ⌘K 搜索并列）
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        useAssistant.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loadUnread = () =>
    api.get<never, { unread: number }>('/notifications/unread-count')
      .then((d) => setUnread(d.unread)).catch(() => {})

  useEffect(() => {
    loadUnread()
    notifTimer.current = window.setInterval(loadUnread, 60_000) // 每分钟轮询未读数
    return () => window.clearInterval(notifTimer.current)
  }, [location.pathname])

  const openNotif = async () => {
    setNotifOpen((v) => !v)
    if (!notifOpen) {
      const d = await api.get<never, { unread: number; items: NotificationItem[] }>(
        '/notifications?limit=20').catch(() => null)
      if (d) { setNotifItems(d.items); setUnread(d.unread) }
    }
  }

  const markRead = async (ids?: number[]) => {
    try {
      await api.post('/notifications/read', ids ? { ids } : { all: true })
      setNotifItems((list) => list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)))
      loadUnread()
    } catch { /* 静默失败即可 */ }
  }

  const gotoNotif = async (n: NotificationItem) => {
    if (!n.read) markRead([n.id])
    setNotifOpen(false)
    if (n.ref_type === 'resource' && n.ref_id) nav(`/resources/${n.ref_id}`)
    else if (n.ref_type === 'memo') nav('/memos')
    else nav('/')
  }

  const logout = () => {
    clear()
    nav('/login')
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:gap-6 sm:px-8">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="返回首页">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-bento transition-transform group-hover:-translate-y-0.5" style={{ backgroundImage: 'var(--brand-grad)' }}>
              <Bot size={19} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">AI Hub</span>
          </Link>

          <MegaMenu />
          {/* 窄屏：保留横向滚动导航 */}
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:hidden">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-brand-600' : 'text-subtle hover:bg-gray-50 hover:text-ink'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            className="hidden items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs text-gray-400 shadow-sm transition hover:border-brand-200 md:flex"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
          >
            <Search size={13} /> 搜索 <kbd className="rounded bg-gray-100 px-1 text-[10px]">Ctrl K</kbd>
          </button>

          <div className="relative">
            <button
              className="relative rounded-xl border border-gray-100 bg-white p-2 text-subtle shadow-sm transition hover:border-brand-200 hover:text-brand-600"
              title="通知中心"
              onClick={openNotif}
            >
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="glass-pop lg-edge absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl" ref={notifGlassRef}>
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <span className="text-sm font-bold">通知中心</span>
                  {unread > 0 && (
                    <button className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      onClick={() => markRead()}>
                      <CheckCheck size={13} /> 全部已读
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifItems.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-gray-400">暂无通知</p>
                  ) : notifItems.map((n) => (
                    <button key={n.id} onClick={() => gotoNotif(n)}
                      className={`flex w-full items-start gap-2.5 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 ${n.read ? 'opacity-60' : ''}`}>
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        n.ntype === 'like' ? 'bg-rose-50 text-rose-500'
                        : n.ntype === 'comment' ? 'bg-brand-50 text-brand-600'
                        : 'bg-gray-100 text-gray-500'}`}>
                        {n.ntype === 'like' ? <Heart size={13} fill="currentColor" />
                        : n.ntype === 'comment' ? <MessageCircle size={13} />
                        : <Bell size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">{n.title}</span>
                        {n.content && <span className="mt-0.5 block line-clamp-2 text-[11px] text-subtle">{n.content}</span>}
                        <span className="mt-1 block text-[10px] text-gray-400">{n.created_at}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                    </button>
                  ))}
                </div>
                <button className="w-full border-t border-gray-100 py-2 text-xs text-subtle hover:text-brand-600"
                  onClick={() => { setNotifOpen(false); nav('/') }}>
                  查看今日动态 →
                </button>
              </div>
            )}
          </div>

          <button
            className="rounded-xl border border-gray-100 bg-white p-2 text-subtle shadow-sm transition hover:border-brand-200 hover:text-brand-600"
            title={dark ? '切换到明亮模式' : '切换到深色模式'}
            onClick={() => setDark((v) => !v)}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-sm shadow-sm transition hover:border-brand-200"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                {(user?.display_name || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[120px] truncate">{user?.display_name || user?.username}</span>
            </button>
            {menuOpen && (
              <div className="glass-pop lg-edge absolute right-0 mt-2 w-44 rounded-2xl p-1.5" ref={menuGlassRef} onMouseLeave={() => setMenuOpen(false)}>
                <div className="px-3 py-2 text-xs text-subtle">
                  {user?.domain ? `${user.domain} \\ ` : ''}{user?.username}
                </div>
                <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50" onClick={logout}>
                  <LogOut size={15} /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette />

      <main className="mx-auto max-w-[1200px] px-6 py-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center text-xs text-subtle">AI Hub · 内网 AI 分享平台</footer>
      <BackToTop />
      <FloatingAssistant />
    </div>
  )
}
