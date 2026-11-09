import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, CornerDownLeft, Mail, Newspaper, Notebook, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { NoteLinkItem, SearchHit } from '../types'

const PAGES = [
  { label: '首页', to: '/' },
  { label: '资源库', to: '/resources' },
  { label: '笔记', to: '/memos' },
  { label: 'AI 助手', to: 'assistant' },
  { label: '简报', to: '/briefings' },
  { label: '设置', to: '/settings' },
]

interface Hit { kind: 'page' | 'resource' | 'memo' | 'rss' | 'noteslink'; label: string; sub: string; to: string }

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
      const [found, links] = await Promise.all([
        api.get<never, SearchHit[]>(`/search?q=${encodeURIComponent(kw)}&limit=12`)
          .catch(() => [] as SearchHit[]),
        api.get<never, { items: NoteLinkItem[] }>(`/notes/links?keyword=${encodeURIComponent(kw)}&limit=6`)
          .catch(() => ({ items: [] })),
      ])
      if (cancelled) return
      const toPath = (h: SearchHit) =>
        h.kind === 'resource' ? `/resources/${h.id}` : h.kind === 'memo' ? '/memos' : '/settings'
      const foundHits: Hit[] = found.map((h) => ({
        kind: h.kind,
        label: h.title,
        sub: (h.kind === 'resource' ? '资源' : h.kind === 'memo' ? '笔记' : '资讯') +
             ` · ${h.created_by}`,
        to: toPath(h),
      }))
      const linkHits: Hit[] = links.items.map((l) => ({
        kind: 'noteslink', label: l.title || l.document || l.url, sub: 'Notes 链接', to: '/memos',
      }))
      setHits([...pages, ...foundHits, ...linkHits])
      setCursor(0)
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const go = (hit: Hit) => {
    setOpen(false)
    if (hit.to === 'assistant') { import('../stores/assistant').then(({ useAssistant }) => useAssistant.getState().setOpen(true)); return }
    nav(hit.to)
  }

  const askAssistant = (query: string) => {
    setOpen(false)
    import('../stores/assistant').then(({ useAssistant }) => {
      const st = useAssistant.getState()
      st.setOpen(true)
      window.setTimeout(() => st.send(query), 60)  // 等面板挂载后自动发出
    })
  }

  const iconFor = (kind: Hit['kind']) =>
    kind === 'resource' ? <BookOpen size={15} className="text-brand-500" />
    : kind === 'memo' ? <Notebook size={15} className="text-emerald-500" />
    : kind === 'rss' ? <Newspaper size={15} className="text-sky-500" />
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
            className="glass-pop relative w-full max-w-lg overflow-hidden rounded-bento2"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Search size={16} className="text-gray-400" />
              <input ref={inputRef} className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="搜索页面、资源、笔记、资讯…" value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
                  if (e.key === 'Enter') {
                    if (hits[cursor]) go(hits[cursor])
                    else if (q.trim()) askAssistant(q.trim())  // 无命中时 Enter 直接问 AI 助手
                  }
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
                <p className="py-4 text-center text-sm text-gray-400">没有匹配结果</p>
              )}
              {q.trim() && (
                <button className="mt-1 flex w-full items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-left text-sm text-brand-700 transition hover:border-brand-300"
                  onClick={() => askAssistant(q.trim())}>
                  <Sparkles size={15} />
                  <span className="flex-1 truncate">问 AI 助手：「{q.trim()}」</span>
                  <span className="text-xs text-brand-400">Enter</span>
                </button>
              )}
              {!q.trim() && (
                <div className="px-3 py-4">
                  <p className="mb-2 text-[11px] font-medium text-gray-400">快速跳转</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAGES.map((p) => (
                      <button key={p.to} className="chip bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => go({ kind: 'page', label: p.label, sub: '页面', to: p.to })}>{p.label}</button>
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
