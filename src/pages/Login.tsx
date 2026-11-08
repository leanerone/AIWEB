import { motion } from 'framer-motion'
import { Bot, KeyRound, Loader2, LogIn, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { useToast } from '../components/ui/Toast'
import type { AuthUser } from '../types'

interface LoginResp {
  token: string
  user: AuthUser
}

export function Login() {
  const nav = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const token = useAuth((s) => s.token)
  const toast = useToast()

  const [ssoState, setSsoState] = useState<'trying' | 'failed' | 'success'>('trying')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (token) { nav('/', { replace: true }); return }
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<never, LoginResp>('/auth/windows')
        if (!cancelled) {
          setAuth(data.token, data.user)
          setSsoState('success')
          nav('/', { replace: true })
        }
      } catch {
        if (!cancelled) setSsoState('failed')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const manualLogin = async () => {
    if (!username.trim() || !password) { toast('info', '请输入用户名和密码'); return }
    setBusy(true)
    try {
      const data = await api.post<never, LoginResp>('/auth/login', { username, password })
      setAuth(data.token, data.user)
      nav('/', { replace: true })
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden p-6">
      {/* 背景装饰光斑 */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-md rounded-bento2 border border-white/60 bg-white/85 p-8 shadow-bentoHover backdrop-blur-xl"
      >
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-bento" style={{ backgroundImage: 'var(--brand-grad)' }}>
            <Bot size={26} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            欢迎来到 <span className="gradient-text">AI Hub</span>
          </h1>
          <p className="mt-1 text-sm text-subtle">内网 AI 分享平台 · Skills / 工具 / 插件 / 笔记</p>
        </div>

        {ssoState === 'trying' && (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-brand-50 py-6 text-sm text-brand-700">
            <Loader2 size={16} className="animate-spin" /> 正在尝试 Windows 域自动登录…
          </div>
        )}

        {ssoState === 'failed' && (
          <div className="space-y-3">
            <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-subtle">
              Windows 域自动登录不可用（可能在非域环境或跨机器访问），请使用账号登录
            </div>
            <div className="relative">
              <UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10" placeholder="用户名" value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualLogin()} />
            </div>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10" type="password" placeholder="密码" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualLogin()} />
            </div>
            <button className="btn-primary w-full py-2.5" onClick={manualLogin} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              登录
            </button>
            <p className="text-center text-xs text-gray-400">初始内置账号密码见 backend/.env 说明</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
