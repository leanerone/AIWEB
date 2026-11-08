import { motion } from 'framer-motion'
import { Bot, BookOpen, LayoutGrid, LogOut, Moon, Notebook, Search, Settings as SettingsIcon, Sparkles, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { CommandPalette } from './CommandPalette'

const NAV = [
  { to: '/', label: '首页', icon: LayoutGrid },
  { to: '/resources', label: '资源库', icon: BookOpen },
  { to: '/memos', label: '笔记', icon: Notebook },
  { to: '/chat', label: 'AI 对话', icon: Sparkles },
  { to: '/settings', label: '设置', icon: SettingsIcon },
]

export function Layout() {
  const { user, clear } = useAuth()
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('aiweb_theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('aiweb_theme', dark ? 'dark' : 'light')
  }, [dark])

  const logout = () => {
    clear()
    nav('/login')
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-bento" style={{ backgroundImage: 'var(--brand-grad)' }}>
              <Bot size={19} />
            </span>
            <span className="text-lg font-bold tracking-tight">
              AI <span className="gradient-text">Hub</span>
            </span>
          </div>

          <nav className="flex flex-1 items-center gap-1">
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
                {({ isActive }) => (
                  <>
                    <Icon size={16} />
                    {label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-xl bg-brand-50"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <button
            className="hidden items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs text-gray-400 shadow-sm transition hover:border-brand-200 md:flex"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
          >
            <Search size={13} /> 搜索 <kbd className="rounded bg-gray-100 px-1 text-[10px]">Ctrl K</kbd>
          </button>

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
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-bento" onMouseLeave={() => setMenuOpen(false)}>
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

      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>

      <footer className="py-8 text-center text-xs text-gray-300">AI Hub · 内网 AI 分享平台</footer>
    </div>
  )
}
