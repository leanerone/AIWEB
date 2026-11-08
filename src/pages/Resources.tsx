import { motion } from 'framer-motion'
import { Download, FileText, FileUp, Heart, Loader2, Package, Plus, Puzzle, Search, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { useList } from '../hooks/useList'
import { BentoCard } from '../components/BentoCard'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import type { Resource } from '../types'

/** 点赞按钮（乐观更新） */
export function LikeButton({ resource, onToggle }: { resource: Resource; onToggle?: (r: Resource) => void }) {
  const toast = useToast()
  const like = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const d = await api.post<never, { likes: number; liked_by_me: boolean }>(`/resources/${resource.id}/like`)
      onToggle?.({ ...resource, likes: d.likes, liked_by_me: d.liked_by_me })
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }
  return (
    <button onClick={like}
      className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] transition ${
        resource.liked_by_me ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'
      }`} title={resource.liked_by_me ? '取消点赞' : '点赞'}>
      <Heart size={13} fill={resource.liked_by_me ? 'currentColor' : 'none'} /> {resource.likes}
    </button>
  )
}

const TABS = [
  { key: '', label: '全部', icon: Package },
  { key: 'skill', label: 'Skills', icon: FileText },
  { key: 'tool', label: '小工具', icon: Wrench },
  { key: 'plugin', label: '插件', icon: Puzzle },
]

const TYPE_LABEL: Record<string, string> = { skill: 'Skill', tool: '工具', plugin: '插件' }
const TYPE_GRAD: Record<string, string> = {
  skill: 'from-brand-500 to-violet-600',
  tool: 'from-emerald-500 to-teal-600',
  plugin: 'from-amber-500 to-orange-600',
}
const TYPE_ICON: Record<string, typeof Package> = { skill: FileText, tool: Wrench, plugin: Puzzle }

export function Resources() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const me = useAuth((s) => s.user)
  const [showForm, setShowForm] = useState(false)
  const [order, setOrder] = useState('new')
  const [likedMap, setLikedMap] = useState<Record<number, Pick<Resource, 'likes' | 'liked_by_me'>>>({})

  const { keyword, setKeyword, items, loading, reload } = useList<Resource>(
    (p) => api.get<never, { total: number; items: Resource[] }>(
      `/resources?keyword=${encodeURIComponent(p.keyword)}&type=${type}&order=${order}&page=${p.page}&limit=60`,
    ),
    [type, order],
    60,
  )

  const applyLike = (r: Resource) => setLikedMap((m) => ({ ...m, [r.id]: { likes: r.likes, liked_by_me: r.liked_by_me } }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight">资源库</h1>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input w-60 pl-9" placeholder="搜索资源…" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className="input w-28 cursor-pointer" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="new">最新</option>
          <option value="likes">最多点赞</option>
          <option value="downloads">最多下载</option>
          <option value="views">最多浏览</option>
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 上传资源
        </button>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams(t.key ? { type: t.key } : {})}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              type === t.key ? 'bg-brand-600 text-white shadow-bento' : 'bg-white text-subtle hover:text-ink border border-gray-100'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-400" size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="还没有资源"
          hint="把你的 SKILL.md 技能包、小脚本、插件传上来，让同事一起用"
          action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> 上传第一个</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r0, i) => {
            const r = { ...r0, ...(likedMap[r0.id] ?? {}) }
            return (
            <BentoCard key={r.id} delay={Math.min(i * 0.04, 0.5)} className="overflow-hidden">
              <Link to={`/resources/${r.id}`} className="block">
                <div className={`flex h-20 items-center justify-between bg-gradient-to-br px-5 ${TYPE_GRAD[r.type] ?? TYPE_GRAD.skill}`}>
                  {(() => { const Icon = TYPE_ICON[r.type] ?? Package; return <Icon size={26} className="text-white/90" /> })()}
                  <span className="chip bg-white/20 text-white">{TYPE_LABEL[r.type]}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{r.created_by}</span>
                    <span>{r.created_at}</span>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-bold text-ink">{r.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-5 text-subtle">
                    {r.summary || r.content.slice(0, 80) || '（无描述）'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.tags.slice(0, 4).map((t) => (
                      <span key={t} className="chip bg-gray-100 text-gray-600">#{t}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Download size={12} /> {r.downloads}</span>
                    <LikeButton resource={r} onToggle={applyLike} />
                  </div>
                </div>
              </Link>
            </BentoCard>
            )
          })}
        </div>
      )}

      {showForm && <CreateForm onClose={() => { setShowForm(false); reload() }} defaultAuthor={me?.display_name || me?.username || ''} />}
    </div>
  )
}

function CreateForm({ onClose, defaultAuthor }: { onClose: () => void; defaultAuthor: string }) {
  const toast = useToast()
  const [type, setType] = useState('skill')
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim()) { toast('info', '请填写资源名称'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('name', name)
      fd.append('summary', summary)
      fd.append('content', content)
      fd.append('tags', tags)
      fd.append('author', defaultAuthor)
      fd.append('external_url', externalUrl)
      if (file) fd.append('file', file)
      await api.post('/resources', fd)
      toast('success', '资源已上架')
      onClose()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-bento2 bg-white p-6 shadow-bentoHover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">上传资源</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {TABS.slice(1).map((t) => (
              <button key={t.key} onClick={() => setType(t.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  type === t.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-subtle hover:border-brand-300'
                }`}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
          <input className="input" placeholder="名称，如：excel-batch-tool" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="一句话简介" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <textarea className="input min-h-[110px]" placeholder="详细介绍（支持 Markdown）" value={content} onChange={(e) => setContent(e.target.value)} />
          <input className="input" placeholder="标签，逗号分隔：excel,自动化" value={tags} onChange={(e) => setTags(e.target.value)} />
          <input className="input" placeholder="外链地址（可选，如 Git 仓库 / 文档链接）" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-subtle transition hover:border-brand-400 hover:text-brand-600">
            <FileUp size={16} />
            {file ? file.name : '上传附件（可选）：SKILL.md / zip / 脚本…'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" />} 上架
          </button>
        </div>
      </motion.div>
    </div>
  )
}
