import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, CornerDownLeft, Mail, Notebook, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Memo, NoteLinkItem, Resource } from '../types'

const PAGES = [
  { label: '首页', to: '/' },
  { label: '资源库', to: '/resources' },
  { label: '笔记', to: '/memos' },
  { label: 'AI 对话', to: '/chat' },
  { label: '设置', to: '/settings' },
]

interface Hit { kind: 'page' | 'resource' | 'memo' | 'noteslink'; label: string; sub: string; to: string }

/** ⌘K / Ctrl+K 全局命令面板：搜页面 / 资源 / 笔记 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [cursor, setCursor] = useState(0)
  const nav = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    else { setQ(''); setHits([]); setCursor(0) }
  }, [open])

  useEffect(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) { setHits([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const pages: Hit[] = PAGES.filter((p) => p.label.toLowerCase().includes(kw))
        .map((p) => ({ kind: 'page', label: p.label, sub: '页面', to: p.to }))
      const [res, memos, links] = await Promise.all([
        api.get<never, { items: Resource[] }>(`/resources?keyword=${encodeURIComponent(kw)}&limit=6`).catch(() => ({ items: [] })),
        api.get<never, { items: Memo[] }>(`/memos?keyword=${encodeURIComponent(kw)}&limit=6`).catch(() => ({ items: [] })),
        api.get<never, { items: NoteLinkItem[] }>(`/notes/links?keyword=${encodeURIComponent(kw)}&limit=6`).catch(() => ({ items: [] })),
      ])
      if (cancelled) return
      const resHits: Hit[] = res.items.map((r) => ({
        kind: 'resource', label: r.name, sub: `资源 · ${r.type} · ${r.created_by}`, to: `/resources/${r.id}`,
      }))
      const memoHits: Hit[] = memos.items.map((m) => ({
        kind: 'memo', label: m.title, sub: `笔记 · ${m.created_by}`, to: '/memos',
      }))
      const linkHits: Hit[] = links.items.map((l) => ({
        kind: 'noteslink', label: l.title || l.document || l.url, sub: 'Notes 链接', to: '/memos',
      }))
      setHits([...pages, ...resHits, ...memoHits, ...linkHits])
      setCursor(0)
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const go = (hit: Hit) => { setOpen(false); nav(hit.to) }

  const iconFor = (kind: Hit['kind']) =>
    kind === 'resource' ? <BookOpen size={15} className="text-brand-500" />
    : kind === 'memo' ? <Notebook size={15} className="text-emerald-500" />
    : kind === 'noteslink' ? <Mail size={15} className="text-amber-500" />
    : <Sparkles size={15} className="text-violet-500" />

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-start justify-center bg-ink/25 p-4 pt-[16vh] backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-lg overflow-hidden rounded-bento2 bg-white shadow-bentoHover"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Search size={16} className="text-gray-400" />
              <input ref={inputRef} className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="搜索页面、资源、笔记…" value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
                  if (e.key === 'Enter' && hits[cursor]) go(hits[cursor])
                }} />
              <kbd className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {hits.map((h, i) => (
                <button key={`${h.kind}-${h.label}-${i}`}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === cursor ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}
                  onMouseEnter={() => setCursor(i)} onClick={() => go(h)}>
                  {iconFor(h.kind)}
                  <span className="flex-1 truncate font-medium">{h.label}</span>
                  <span className="text-xs text-gray-400">{h.sub}</span>
                  {i === cursor && <CornerDownLeft size={13} className="text-brand-400" />}
                </button>
              ))}
              {q.trim() && hits.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">没有匹配结果</p>
              )}
              {!q.trim() && (
                <div className="px-3 py-4">
                  <p className="mb-2 text-[11px] font-medium text-gray-400">快速跳转</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAGES.map((p) => (
                      <button key={p.to} className="chip bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => { setOpen(false); nav(p.to) }}>{p.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
