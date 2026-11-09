import { BookmarkPlus, ChevronDown, ChevronRight, DatabaseBackup, ExternalLink, KeyRound, Loader2, Plus, RefreshCw, Rss, Save, Sparkles, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { BentoCard } from '../components/BentoCard'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import type { MyAiConfigData, RssItem, RssSourceItem } from '../types'

interface UserItem { id: number; username: string; display_name: string; role: string; department: string }

/** 个人 AI 设置：每人自己的 Key（加密存储），折叠轻量入口 */
function MyAiConfig() {
  const toast = useToast()
  const me = useAuth((s) => s.user)
  const [cfg, setCfg] = useState<MyAiConfigData | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const load = () => api.get<never, MyAiConfigData>('/me/ai-config').then(setCfg).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!cfg) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        api_base: cfg.api_base, model: cfg.model,
        system_prompt: cfg.system_prompt, auto_exec: cfg.auto_exec,
      }
      if (apiKey && apiKey !== '********') body.api_key = apiKey
      await api.put('/me/ai-config', body)
      toast('success', '个人 AI 设置已保存')
      setApiKey('')
      load()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sourceLabel = {
    user: '✓ 使用你的个人 Key',
    global: '回落管理员配置的全局 Key',
    env: '回落服务端 .env 配置',
  }[cfg?.effective.source ?? 'env']

  return (
    <BentoCard className="h-fit p-6" delay={0.04}>
      <button className="mb-1 flex w-full items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><KeyRound size={17} /></span>
        <span className="mr-auto">
          <span className="block text-sm font-bold">个人 AI 设置</span>
          <span className="block text-[11px] text-subtle">
            {cfg?.effective.has_key ? sourceLabel : '未配置 Key —— 悬浮助手 / 简报等功能需要'}
          </span>
        </span>
        {cfg?.effective.has_key && <span className="chip bg-emerald-50 text-emerald-600">Key 就绪</span>}
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && cfg && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div>
            <label className="mb-1 block text-xs text-subtle">API Key（仅本人可见，加密存储）</label>
            <input className="input" type="password" placeholder={cfg.api_key || 'sk-...'}
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <p className="mt-1 text-[11px] text-gray-400">留空不修改；填写后优先于全局配置生效</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-subtle">API Base（可选，默认同全局）</label>
              <input className="input" placeholder="https://api.openai.com/v1" value={cfg.api_base}
                onChange={(e) => setCfg({ ...cfg, api_base: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-subtle">模型（可选）</label>
              <input className="input" placeholder={cfg.effective.model || 'gpt-4o-mini'} value={cfg.model}
                onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-subtle">助手人设（可选，只对你生效）</label>
            <textarea className="input min-h-[64px]" placeholder="例：回答简洁专业，使用中文。"
              value={cfg.system_prompt} onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-subtle">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={cfg.auto_exec}
              onChange={(e) => setCfg({ ...cfg, auto_exec: e.target.checked })} />
            助手写操作自动执行（关闭时每次写操作都会先征求你的确认）
          </label>
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-subtle">
            当前生效：{cfg.effective.api_base} · {cfg.effective.model || '默认模型'} · {sourceLabel}
          </p>
          {testResult && (
            <p className={`rounded-xl px-3 py-2 text-xs ${testResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {testResult}
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 保存
            </button>
            <button className="btn-ghost flex-1" disabled={testing}
              onClick={async () => {
                setTesting(true)
                setTestResult('')
                try {
                  const r = await api.get<never, { success: boolean; message?: string; data?: { base: string; model: string; count: number } }>('/ai/test')
                  setTestResult(r.success && r.data
                    ? `✓ 连接成功：${r.data.base} · ${r.data.model} · 可用模型 ${r.data.count} 个`
                    : `✗ ${r.message || '连接失败'}`)
                } catch (e) {
                  setTestResult(`✗ ${(e as Error).message}`)
                } finally {
                  setTesting(false)
                }
              }}>
              {testing ? <Loader2 size={15} className="animate-spin" /> : null} 测试连接
            </button>
          </div>
          {me?.role === 'admin' && (
            <p className="text-[11px] text-gray-400">
              管理员提示：全局兜底 Key 请配置在 backend/.env（AI_API_KEY），此界面不再保存全局键。
            </p>
          )}
        </div>
      )}
    </BentoCard>
  )
}

/** 成员管理（仅管理员可见） */
function MemberAdmin() {
  const me = useAuth((s) => s.user)
  const toast = useToast()
  const [users, setUsers] = useState<UserItem[]>([])
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'user' })
  const [busy, setBusy] = useState(false)

  const load = () => api.get<never, UserItem[]>('/auth/users').then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  if (me?.role !== 'admin') return null

  const create = async () => {
    if (!form.username.trim() || !form.password) { toast('info', '用户名和密码必填'); return }
    setBusy(true)
    try {
      await api.post('/auth/users', form)
      toast('success', '成员已创建')
      setForm({ username: '', display_name: '', password: '', role: 'user' })
      load()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BentoCard className="h-fit p-6" delay={0.18}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Users size={17} /></span>
        <h2 className="text-sm font-bold">成员管理</h2>
        <span className="chip bg-brand-50 text-brand-600">管理员</span>
      </div>
      <div className="mb-3 space-y-1.5">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
              {(u.display_name || u.username).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{u.display_name || u.username}</p>
              <p className="text-[11px] text-gray-400">{u.username}{u.department ? ` · ${u.department}` : ''}</p>
            </div>
            {u.role === 'admin' && <span className="chip bg-violet-100 text-violet-700">admin</span>}
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="用户名（域账号）" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" placeholder="显示名" value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="password" placeholder="初始密码" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input cursor-pointer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="user">普通成员</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <button className="btn-primary w-full" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} 创建成员
        </button>
        <button
          className="btn-ghost w-full"
          onClick={() => {
            const token = localStorage.getItem('aiweb_token')
            fetch('/api/admin/backup', { headers: { Authorization: `Bearer ${token}` } })
              .then(async (r) => {
                if (!r.ok) throw new Error('备份下载失败')
                const blob = await r.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'aiweb-backup.sqlite'
                a.click()
                URL.revokeObjectURL(url)
                toast('success', '备份已下载')
              })
              .catch((e) => toast('error', e.message))
          }}
        >
          <DatabaseBackup size={15} /> 下载数据备份（SQLite）
        </button>
      </div>
    </BentoCard>
  )
}

export function Settings() {
  const toast = useToast()
  const [sources, setSources] = useState<RssSourceItem[]>([])
  const [items, setItems] = useState<RssItem[]>([])
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)

  const load = () => {
    api.get<never, RssSourceItem[]>('/rss/sources').then(setSources).catch(() => {})
    api.get<never, { items: RssItem[] }>('/rss/items?limit=30').then((d) => setItems(d.items)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const addSource = async () => {
    if (!newUrl.trim()) { toast('info', '请填写 RSS 地址'); return }
    try {
      await api.post('/rss/sources', { name: newName || newUrl.slice(0, 40), url: newUrl })
      toast('success', '订阅源已添加')
      setNewName(''); setNewUrl('')
      load()
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const refreshAll = async () => {
    setRefreshing(true)
    try {
      const r = await api.post<never, { new: number }>('/rss/refresh')
      toast('success', `刷新完成，新增 ${r.new} 条`)
      load()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  const delSource = async () => {
    if (!delId) return
    await api.delete(`/rss/sources/${delId}`).catch((e) => toast('error', (e as Error).message))
    setDelId(null)
    load()
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 个人 AI 设置（折叠轻量入口）+ 管理员工具 */}
      <div className="space-y-4">
        <MyAiConfig />
        <MemberAdmin />
      </div>

      {/* RSS 订阅 */}
      <div className="space-y-4">
        <BentoCard id="rss" className="scroll-mt-24 p-6" delay={0.06}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Rss size={17} /></span>
            <h2 className="mr-auto text-sm font-bold">AI 资讯订阅</h2>
            <button className="btn-ghost !py-1.5" onClick={refreshAll} disabled={refreshing}>
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 全部刷新
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <input className="input w-28 shrink-0" placeholder="名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input flex-1" placeholder="RSS 地址，如 https://hnrss.org/newest?q=AI" value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSource()} />
            <button className="btn-primary shrink-0" onClick={addSource}><Plus size={15} /></button>
          </div>
          <div className="space-y-1.5">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.enabled ? (s.last_error ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-[11px] text-gray-400">{s.url}</p>
                  {s.last_error && <p className="truncate text-[11px] text-amber-600" title={s.last_error}>⚠ {s.last_error}</p>}
                </div>
                <button className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" onClick={() => setDelId(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sources.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">还没有订阅源，先添加一个试试</p>
            )}
          </div>
        </BentoCard>

        <BentoCard className="p-5" delay={0.12}>
          <h3 className="mb-3 text-sm font-bold">最新资讯</h3>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {items.map((it) => (
              <div key={it.id} className="group flex items-start gap-2 rounded-xl p-2.5 transition hover:bg-gray-50">
                <ExternalLink size={13} className="mt-1 shrink-0 text-sky-500" />
                <a href={it.link} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="text-[11px] text-gray-400">{it.source} · {it.published_at || ''}</p>
                </a>
                <button title="AI 生成知识卡并沉淀到首页" className="hidden shrink-0 rounded-lg p-1.5 text-violet-500 hover:bg-violet-50 group-hover:block"
                  onClick={async () => {
                    try {
                      const d = await api.post<never, { id: number; title: string }>('/ai/rss-card', { rss_item_id: it.id })
                      toast('success', `知识卡已生成：${d.title.slice(0, 30)}…`)
                    } catch (e) { toast('error', (e as Error).message) }
                  }}>
                  <Sparkles size={14} />
                </button>
                <button title="保存为笔记" className="hidden shrink-0 rounded-lg p-1.5 text-subtle hover:bg-brand-50 hover:text-brand-600 group-hover:block"
                  onClick={async () => {
                    try {
                      await api.post('/memos', {
                        title: it.title,
                        content: `${it.summary || it.title}\n\n原文：${it.link}\n来源：${it.source}`,
                        tags: ['rss', it.source || '资讯'],
                      })
                      toast('success', '已保存为笔记')
                    } catch (e) { toast('error', (e as Error).message) }
                  }}>
                  <BookmarkPlus size={14} />
                </button>
              </div>
            ))}
            {items.length === 0 && <p className="py-6 text-center text-xs text-gray-400">暂无资讯，点「全部刷新」抓取</p>}
          </div>
        </BentoCard>
      </div>

      <ConfirmDialog open={!!delId} danger title="删除订阅源" message="删除后该源的资讯条目也会清除。"
        onConfirm={delSource} onCancel={() => setDelId(null)} />
    </div>
  )
}
