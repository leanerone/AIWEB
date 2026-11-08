import { ExternalLink, Loader2, Notebook, Pencil, Pin, PinOff, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useList } from '../hooks/useList'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { NotesLinkCard } from '../components/NotesLinkCard'
import { NotesInlineLinks } from '../components/NotesInlineLinks'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import type { Memo, NoteLinkItem } from '../types'

interface MemoForm { id?: number; title: string; content: string; tags: string; pinned: boolean }
const EMPTY: MemoForm = { title: '', content: '', tags: '', pinned: false }

export function Memos() {
  const toast = useToast()
  const [form, setForm] = useState<MemoForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)
  const [links, setLinks] = useState<NoteLinkItem[]>([])

  const { keyword, setKeyword, items, loading, reload } = useList<Memo>(
    (p) => api.get<never, { total: number; items: Memo[] }>(
      `/memos?keyword=${encodeURIComponent(p.keyword)}&page=${p.page}&limit=100`,
    ),
    [],
    100,
  )

  const loadLinks = () => {
    api.get<never, { items: NoteLinkItem[] }>('/notes/links?limit=50').then((d) => setLinks(d.items)).catch(() => {})
  }
  useEffect(loadLinks, [])

  const save = async () => {
    if (!form || !form.title.trim()) { toast('info', '标题不能为空'); return }
    setBusy(true)
    const payload = {
      title: form.title,
      content: form.content,
      pinned: form.pinned,
      tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    }
    try {
      if (form.id) await api.put(`/memos/${form.id}`, payload)
      else await api.post('/memos', payload)
      toast('success', '笔记已保存')
      setForm(null)
      reload()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const togglePin = async (m: Memo) => {
    try {
      await api.put(`/memos/${m.id}`, { title: m.title, content: m.content, tags: m.tags, pinned: !m.pinned })
      reload()
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const del = async () => {
    if (!delId) return
    try {
      await api.delete(`/memos/${delId}`)
      toast('success', '已删除')
      reload()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setDelId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight">笔记</h1>
        <input className="input w-56" placeholder="搜索笔记…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> 新建笔记</button>
      </div>

      {/* Notes 链接库 */}
      <BentoCard className="p-5" delay={0.05}>
        <h2 className="mb-1 text-sm font-bold">Notes 链接库</h2>
        <p className="mb-3 text-xs text-subtle">保存解析过的 HCL Notes 文档链接，点击「打开」唤起本机 Notes 客户端</p>
        <NotesLinkCard onSaved={() => { loadLinks(); toast('success', '链接已入库') }} />
        {links.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.title || l.document || '（无标题）'}</p>
                  <p className="truncate text-[11px] text-gray-400">{l.server} / {l.database}</p>
                </div>
                <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => {
                  const a = document.createElement('a'); a.href = l.url; a.style.display = 'none'
                  document.body.appendChild(a); a.click(); a.remove()
                }}><ExternalLink size={13} /> 打开</button>
                <button className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" onClick={async () => {
                  await api.delete(`/notes/links/${l.id}`); loadLinks()
                }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </BentoCard>

      {/* 编辑器 */}
      {form && (
        <BentoCard className="p-5" delay={0}>
          <div className="mb-3 flex items-center gap-2">
            <input className="input flex-1 font-semibold" placeholder="笔记标题…" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            <button className={form.pinned ? 'btn bg-amber-100 text-amber-700' : 'btn-ghost'}
              onClick={() => setForm({ ...form, pinned: !form.pinned })} title="置顶">
              {form.pinned ? <Pin size={15} /> : <PinOff size={15} />}
            </button>
          </div>
          <textarea className="input min-h-[180px] font-mono text-[13px]" placeholder="正文，支持 Markdown…"
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <NotesInlineLinks text={form.content} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="input w-64" placeholder="标签，逗号分隔" value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <div className="mr-auto" />
            <button className="btn-ghost" onClick={() => setForm(null)}><X size={15} /> 取消</button>
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 保存
            </button>
          </div>
        </BentoCard>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-400" size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Notebook} title="还没有笔记"
          hint="记录排障步骤、机台备注、AI 使用心得…支持 Markdown 和 Notes 链接"
          action={<button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={15} /> 写第一篇</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((m, i) => (
            <BentoCard key={m.id} delay={Math.min(i * 0.03, 0.4)} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {m.pinned && <Pin size={13} className="shrink-0 text-amber-500" />}
                  {m.title}
                </h3>
                <div className="flex shrink-0 gap-1">
                  <button title={m.pinned ? '取消置顶' : '置顶'}
                    className={`rounded-lg p-1.5 ${m.pinned ? 'text-amber-500' : 'text-subtle hover:bg-gray-100 hover:text-amber-600'}`}
                    onClick={() => togglePin(m)}>
                    <Pin size={14} />
                  </button>
                  <button className="rounded-lg p-1.5 text-subtle hover:bg-gray-100 hover:text-brand-600"
                    onClick={() => setForm({ id: m.id, title: m.title, content: m.content, tags: m.tags.join(','), pinned: m.pinned })}>
                    <Pencil size={14} />
                  </button>
                  <button className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" onClick={() => setDelId(m.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-40 overflow-hidden">
                <MarkdownView text={m.content.slice(0, 300)} />
                <NotesInlineLinks text={m.content} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-50 pt-3">
                {m.tags.map((t) => <span key={t} className="chip bg-gray-100 text-gray-600">#{t}</span>)}
                <span className="ml-auto text-[11px] text-gray-400">{m.created_by} · {m.updated_at}</span>
              </div>
            </BentoCard>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!delId} danger title="删除笔记" message="删除后不可恢复，确定吗？"
        onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  )
}
