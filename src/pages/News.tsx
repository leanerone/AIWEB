import { BookmarkPlus, ExternalLink, Loader2, Plus, RefreshCw, Rss, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { BentoCard } from '../components/BentoCard'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import type { RssItem, RssSourceItem } from '../types'

/** 资讯：RSS 订阅源管理 + 最新条目（可存为笔记 / 生成 AI 知识卡）。原置于设置页，现独立成页 */
export function News() {
  const toast = useToast()
  const [sources, setSources] = useState<RssSourceItem[]>([])
  const [items, setItems] = useState<RssItem[]>([])
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId] = useState<number | null>(null)

  const load = () => {
    api.get<never, RssSourceItem[]>('/rss/sources').then(setSources).catch(() => {})
    api.get<never, { items: RssItem[] }>('/rss/items?limit=50')
      .then((d) => setItems(d.items)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const addSource = async () => {
    if (!newUrl.trim()) { toast('info', '请填写 RSS 地址'); return }
    try {
      await api.post('/rss/sources', { name: newName || newUrl.slice(0, 40), url: newUrl })
      toast('success', '订阅源已添加')
      setNewName(''); setNewUrl('')
      load()
    } catch (e) { toast('error', (e as Error).message) }
  }

  const refreshAll = async () => {
    setRefreshing(true)
    try {
      const r = await api.post<never, { new: number }>('/rss/refresh')
      toast('success', `刷新完成，新增 ${r.new} 条`)
      load()
    } catch (e) { toast('error', (e as Error).message) }
    finally { setRefreshing(false) }
  }

  const delSource = async () => {
    if (!delId) return
    await api.delete(`/rss/sources/${delId}`).catch((e) => toast('error', (e as Error).message))
    setDelId(null)
    load()
  }

  const saveAsNote = async (it: RssItem) => {
    try {
      await api.post('/memos', {
        title: it.title,
        content: `${it.summary || it.title}\n\n原文：${it.link}\n来源：${it.source}`,
        tags: ['rss', it.source || '资讯'],
      })
      toast('success', '已保存为笔记')
    } catch (e) { toast('error', (e as Error).message) }
  }

  const makeCard = async (it: RssItem) => {
    setGenerating(it.id)
    try {
      const d = await api.post<never, { id: number; title: string }>('/ai/rss-card', { rss_item_id: it.id })
      toast('success', `知识卡已生成：${d.title.slice(0, 30)}…`)
    } catch (e) { toast('error', (e as Error).message) }
    finally { setGenerating(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-2 text-xl font-bold tracking-tight">
          <Rss size={19} className="text-brand-500" /> 资讯
        </h1>
        <Link to="/briefings" className="btn-ghost !py-2 text-sm">每日简报归档</Link>
        <button className="btn-primary" onClick={refreshAll} disabled={refreshing}>
          {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} 刷新资讯
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 最新资讯列表 */}
        <BentoCard className="lg:col-span-2 p-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold">最新资讯</h2>
            <span className="text-xs text-gray-400">{items.length} 条</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-400" size={26} /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Rss} title="还没有资讯"
              hint="在右侧添加订阅源并点「刷新资讯」，抓取到的最新条目会出现在这里" />
          ) : (
            <div className="max-h-[560px] divide-y divide-gray-50 overflow-y-auto">
              {items.map((it) => (
                <div key={it.id} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50">
                  <ExternalLink size={14} className="mt-1 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <a href={it.link} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-ink hover:text-brand-600">
                      {it.title}
                    </a>
                    {it.summary && <p className="mt-0.5 line-clamp-1 text-xs text-subtle">{it.summary}</p>}
                    <p className="mt-0.5 text-[11px] text-gray-400">{it.source} · {it.published_at || ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button title="AI 生成知识卡" disabled={generating === it.id}
                      className="rounded-lg p-1.5 text-violet-500 transition hover:bg-violet-50 disabled:opacity-50"
                      onClick={() => makeCard(it)}>
                      {generating === it.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                    <button title="保存为笔记"
                      className="rounded-lg p-1.5 text-subtle transition hover:bg-brand-50 hover:text-brand-600"
                      onClick={() => saveAsNote(it)}>
                      <BookmarkPlus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </BentoCard>

        {/* 订阅源管理 */}
        <BentoCard className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Rss size={16} /></span>
            <h2 className="text-sm font-bold">订阅源</h2>
            <span className="chip bg-gray-100 text-gray-600">{sources.length}</span>
          </div>
          <div className="mb-3 space-y-2">
            <input className="input !py-2 text-sm" placeholder="名称（可选）" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex gap-2">
              <input className="input text-sm" placeholder="RSS 地址，如 https://hnrss.org/newest?q=AI" value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSource()} />
              <button className="btn-primary shrink-0 !px-3" onClick={addSource}><Plus size={15} /></button>
            </div>
          </div>
          <div className="space-y-1.5">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.enabled ? (s.last_error ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-[11px] text-gray-400">{s.url}</p>
                  {s.last_error && <p className="truncate text-[11px] text-amber-600" title={s.last_error}>⚠ {s.last_error}</p>}
                </div>
                <button className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50" onClick={() => setDelId(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sources.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">还没有订阅源，先添加一个试试</p>
            )}
          </div>
        </BentoCard>
      </div>

      <ConfirmDialog open={!!delId} danger title="删除订阅源" message="删除后该源的资讯条目也会清除。"
        onConfirm={delSource} onCancel={() => setDelId(null)} />
    </div>
  )
}
