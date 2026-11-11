import { AnimatePresence, motion } from 'framer-motion'
import {
  Check, ChevronLeft, Copy, FileDown, GripHorizontal, History, Loader2, MessageCircle, Pencil, Plus,
  Send, Square, Trash2, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAssistant, type AssistantMsg } from '../../stores/assistant'
import { downloadText } from '../../utils/time'
import { useLiquidGlass } from '../../hooks/useLiquidGlass'
import { MarkdownView } from '../MarkdownView'
import { SiriOrb } from './SiriOrb'
import { useToast } from '../ui/Toast'
import type { Resource } from '../../types'

/** 根据路由计算页面上下文标签（发给 AI 作隐藏上下文） */
const PAGE_LABEL: Record<string, string> = {
  '/': '首页', '/resources': '资源库', '/news': '资讯', '/memos': '笔记',
  '/briefings': '简报归档', '/settings': '设置',
}

function usePageContext() {
  const location = useLocation()
  const { pathname } = location
  const setPageContext = useAssistant((s) => s.setPageContext)

  useEffect(() => {
    let dead = false
    const m = pathname.match(/^\/resources\/(\d+)$/)
    if (m) {
      const cached = sessionStorage.getItem(`aiweb:res:${m[1]}`)
      if (cached) { setPageContext(`资源详情：${cached}`); return }
      api.get<never, Resource>(`/resources/${m[1]}`)
        .then((r) => {
          if (dead || !r) return
          sessionStorage.setItem(`aiweb:res:${m[1]}`, `${r.name}（id=${r.id}）`)
          setPageContext(`资源详情：${r.name}（id=${r.id}）`)
        })
        .catch(() => {})
    } else {
      setPageContext(PAGE_LABEL[pathname] || '平台内页')
    }
    return () => { dead = true }
  }, [pathname, setPageContext])
}

/** 一条消息：气泡 + Agent 任务卡 + 操作按钮 */
function MessageBubble({ m, streaming, isLast }: { m: AssistantMsg; streaming: boolean; isLast: boolean }) {
  const toast = useToast()
  const saveCard = useAssistant((s) => s.saveCard)
  const regenerate = useAssistant((s) => s.regenerate)
  const steps = m.meta?.steps ?? []

  return (
    <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
        m.role === 'user'
          ? 'text-white shadow-bento [background-image:var(--brand-grad)]'
          : 'bg-gray-50 text-ink dark:bg-white/8 dark:text-gray-100'
      }`}>
        {steps.length > 0 && (
          <div className="mb-2 space-y-1 rounded-xl bg-black/5 p-2 text-[11px] dark:bg-white/10">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-subtle">
                {s.ok ? <Check size={11} className="text-emerald-500" /> : <X size={11} className="text-red-400" />}
                <span className="truncate" title={s.summary}>{s.summary}</span>
              </div>
            ))}
          </div>
        )}
        {m.role === 'assistant'
          ? (streaming && isLast
              ? (m.content || <Loader2 size={14} className="inline animate-spin" />)
              : <MarkdownView text={m.content} />)
          : m.content}
        {m.role === 'assistant' && !streaming && m.content && !m.content.startsWith('⚠️') && (
          <div className="mt-1.5 flex justify-end gap-2.5 border-t border-black/5 pt-1.5 dark:border-white/10">
            <button className="flex items-center gap-1 text-[11px] text-subtle hover:text-brand-600"
              onClick={async () => { await navigator.clipboard.writeText(m.content); toast('success', '已复制') }}>
              <Copy size={10} /> 复制
            </button>
            {isLast && (
              <button className="flex items-center gap-1 text-[11px] text-subtle hover:text-brand-600" onClick={regenerate}>
                重新生成
              </button>
            )}
            <button className="text-[11px] text-brand-600 hover:underline"
              onClick={async () => {
                try { await saveCard(m.content); toast('success', '已沉淀为首页内容卡') }
                catch (e) { toast('error', (e as Error).message) }
              }}>
              ✦ 沉淀
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** ask_user 无选项时的自由文本回答 */
function AskFreeText({ onAnswer }: { onAnswer: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="flex items-end gap-1.5">
      <input className="input flex-1 !py-1.5 text-xs" placeholder="输入你的回答，Enter 发送"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) onAnswer(text.trim())
        }} />
      <button className="btn-primary !p-2" disabled={!text.trim()} onClick={() => onAnswer(text.trim())}>
        <Send size={12} />
      </button>
    </div>
  )
}

export function FloatingAssistant() {
  const nav = useNavigate()
  usePageContext()

  const open = useAssistant((s) => s.open)
  const setOpen = useAssistant((s) => s.setOpen)
  const toggle = useAssistant((s) => s.toggle)
  const messages = useAssistant((s) => s.messages)
  const streaming = useAssistant((s) => s.streaming)
  const sessionId = useAssistant((s) => s.sessionId)
  const sessions = useAssistant((s) => s.sessions)
  const historyOpen = useAssistant((s) => s.historyOpen)
  const setHistoryOpen = useAssistant((s) => s.setHistoryOpen)
  const loadSessions = useAssistant((s) => s.loadSessions)
  const openSession = useAssistant((s) => s.openSession)
  const send = useAssistant((s) => s.send)
  const stop = useAssistant((s) => s.stop)
  const delSession = useAssistant((s) => s.delSession)
  const renameSession = useAssistant((s) => s.renameSession)
  const pendingConfirm = useAssistant((s) => s.pendingConfirm)
  const resolveConfirm = useAssistant((s) => s.resolveConfirm)
  const pendingAsk = useAssistant((s) => s.pendingAsk)
  const answerAsk = useAssistant((s) => s.answerAsk)
  const badge = useAssistant((s) => s.badge)
  const suggestions = useAssistant((s) => s.suggestions)
  const loadSuggestions = useAssistant((s) => s.loadSuggestions)
  const pageContext = useAssistant((s) => s.pageContext)
  const usePageCtx = useAssistant((s) => s.usePageContext)
  const togglePageCtx = useAssistant((s) => s.togglePageContext)

  const [input, setInput] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollBoxRef = useRef<HTMLDivElement>(null)

  // ── 面板尺寸可调（拖右下角手柄），记忆到 localStorage ──
  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aiweb_assistant_size') || 'null')
      if (saved && saved.w >= 360 && saved.w <= 640 && saved.h >= 420 && saved.h <= 800) return saved
    } catch { /* 忽略 */ }
    return { w: 420, h: 560 }
  })
  const resizing = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    // 未拖拽时面板锚定右下角（手柄左移=变宽）；被拖过之后锚定左上角，符号要反过来
    const sgn = pos ? 1 : -1
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const w = Math.min(640, Math.max(360, resizing.current.w + sgn * (ev.clientX - resizing.current.x)))
      const h = Math.min(800, Math.max(420, resizing.current.h + sgn * (ev.clientY - resizing.current.y)))
      setSize({ w, h })
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSize((cur: { w: number; h: number }) => {
        try { localStorage.setItem('aiweb_assistant_size', JSON.stringify(cur)) } catch { /* 忽略 */ }
        return cur
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── 面板可拖拽：按住头部移动，双击头部复位到右下角；位置记忆到 localStorage ──
  const panelRef = useRef<HTMLDivElement | null>(null)
  // 面板条件渲染，用 enabled 让 effect 在挂载后重跑
  const glassRef = useLiquidGlass<HTMLDivElement>({ radius: 24, level: 'focused', enabled: open })
  const setPanelRef = (el: HTMLDivElement | null) => {
    panelRef.current = el
    glassRef.current = el
  }
  const dragging = useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    try {
      const p = JSON.parse(localStorage.getItem('aiweb_assistant_pos') || 'null')
      if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) return p
    } catch { /* 忽略 */ }
    return null
  })

  // 钳制在视口内，留 8px 边距，避免小屏被拖到看不见的地方
  const clampPos = (left: number, top: number) => {
    const el = panelRef.current
    const w = el?.offsetWidth ?? size.w
    const h = el?.offsetHeight ?? size.h
    return {
      left: Math.min(Math.max(left, 8), Math.max(8, window.innerWidth - w - 8)),
      top: Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - h - 8)),
    }
  }

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = panelRef.current
    if (!el || (e.target as HTMLElement).closest('button')) return   // 头部按钮不参与拖拽
    e.preventDefault()
    const r = el.getBoundingClientRect()
    dragging.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    setPos(clampPos(r.left, r.top))                                  // 转为受控位置
    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const { dx, dy } = dragging.current
      setPos(clampPos(ev.clientX - dx, ev.clientY - dy))
    }
    const onUp = () => {
      dragging.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPos((cur) => {
        try {
          if (cur) localStorage.setItem('aiweb_assistant_pos', JSON.stringify(cur))
          else localStorage.removeItem('aiweb_assistant_pos')
        } catch { /* 忽略 */ }
        return cur
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetPos = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return   // 头部按钮的双击不复位
    setPos(null)
    try { localStorage.removeItem('aiweb_assistant_pos') } catch { /* 忽略 */ }
  }

  // ── 悬浮球可自由拖动：位置记忆 + 双击复位；用 5px 阈值区分"拖动"与"点击" ──
  const fabRef = useRef<HTMLButtonElement | null>(null)
  const fabDidDrag = useRef(false)
  const [fabPos, setFabPos] = useState<{ left: number; top: number } | null>(() => {
    try {
      const p = JSON.parse(localStorage.getItem('aiweb_assistant_fab') || 'null')
      if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) return p
    } catch { /* 忽略 */ }
    return null
  })
  const startFabDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = fabRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - r.left - dx, ev.clientY - r.top - dy) < 5) return
      moved = true
      const w = el.offsetWidth
      const h = el.offsetHeight
      const left = Math.min(Math.max(ev.clientX - dx, 8), window.innerWidth - w - 8)
      const top = Math.min(Math.max(ev.clientY - dy, 8), window.innerHeight - h - 8)
      setFabPos({ left, top })
    }
    const onUp = () => {
      fabDidDrag.current = moved
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (moved) setFabPos((cur) => {
        try { if (cur) localStorage.setItem('aiweb_assistant_fab', JSON.stringify(cur)) } catch { /* 忽略 */ }
        return cur
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const onFabClick = () => {
    if (fabDidDrag.current) { fabDidDrag.current = false; return }  // 拖动结束不触发开关
    open ? setOpen(false) : toggle()
  }
  const resetFab = () => {
    setFabPos(null)
    try { localStorage.removeItem('aiweb_assistant_fab') } catch { /* 忽略 */ }
  }

  // 视口变化（含移动端软键盘/旋转）后把面板拉回可见区域
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p.left, p.top) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 恢复上次会话：打开面板且为空时，若有记忆的会话则自动载入 ──
  useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem('aiweb_assistant_session')
    if (saved && !sessionId && messages.length === 0) {
      const id = Number(saved)
      if (id > 0 && sessions.some((x) => x.id === id)) openSession(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && sessions.length === 0) loadSessions()
  }, [open, sessions.length, loadSessions])

  useEffect(() => {
    // 建议轮询常驻（badge 关闭面板也可见）；面板打开时加密到 2 分钟
    loadSuggestions()
    const t = window.setInterval(loadSuggestions, open ? 120_000 : 300_000)
    return () => window.clearInterval(t)
  }, [open, loadSuggestions])

  useEffect(() => {
    // 仅当用户停留在底部附近时自动跟随滚动，回看历史时不打扰
    if (!open) return
    const box = scrollBoxRef.current
    if (!box) { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const doSend = (text?: string) => {
    const t = (text ?? input).trim()
    if (!t) return
    setInput('')
    send(t)
  }

  const act = (s: { action: string; ref?: string }) => {
    if (s.action === 'nav' && s.ref) nav(s.ref)
    else if (s.action === 'prompt') doSend(s.ref)
  }

  return (
    <>
      {/* 悬浮球：Siri 光球 + 玻璃底座，可自由拖动（双击复位） */}
      <motion.button
        ref={fabRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="assistant-fab fixed bottom-24 right-6 z-[65] flex cursor-grab touch-none items-center justify-center rounded-full active:cursor-grabbing lg:bottom-6"
        style={{
          width: 56, height: 56,
          ...(fabPos ? { left: fabPos.left, top: fabPos.top, right: 'auto', bottom: 'auto' } : null),
        }}
        title="AI 助手 · 拖动可移动，双击复位"
        aria-label="打开 AI 助手"
        onPointerDown={startFabDrag}
        onClick={onFabClick}
        onDoubleClick={resetFab}
      >
        <SiriOrb active={streaming || open} size={36} />
        {!open && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="assistant-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="assistant-panel glass-pop lg-edge fixed bottom-[100px] right-4 z-[64] flex max-h-[calc(100vh-130px)] flex-col overflow-hidden rounded-3xl lg:bottom-24 lg:right-6"
            style={{
              width: `min(${size.w}px, calc(100vw - 32px))`,
              height: `min(${size.h}px, calc(100vh - 130px))`,
              // 拖拽过之后由 left/top 定位（清掉 right/bottom 类），否则保持右下角默认
              ...(pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : null),
            }}
            ref={setPanelRef}
          >
            {/* 头部：按住可拖动，双击复位 */}
            <div className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-black/5 px-4 py-3 active:cursor-grabbing dark:border-white/10"
              onPointerDown={startDrag} onDoubleClick={resetPos}
              title="按住拖动窗口位置，双击回到右下角">
              <GripHorizontal size={14} className="-ml-1 shrink-0 text-gray-300 dark:text-white/20" />
              <span className="flex h-8 w-8 items-center justify-center">
                <SiriOrb active={streaming} size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-4">AI 助手</p>
                <p className="truncate text-[10px] text-subtle">{sessionId ? `会话 #${sessionId}` : '新对话'}</p>
              </div>
              <button className="rounded-lg p-1.5 text-subtle hover:bg-black/5 hover:text-brand-600 dark:hover:bg-white/10" title="历史会话"
                onClick={() => setHistoryOpen(!historyOpen)}><History size={15} /></button>
              <button className="rounded-lg p-1.5 text-subtle hover:bg-black/5 hover:text-brand-600 dark:hover:bg-white/10" title="新对话"
                onClick={() => openSession(null)}><Plus size={16} /></button>
              <button className="rounded-lg p-1.5 text-subtle hover:bg-black/5 hover:text-brand-600 dark:hover:bg-white/10" title="收起"
                onClick={() => setOpen(false)}><ChevronLeft size={16} /></button>
            </div>

            {/* 历史抽屉 */}
            {historyOpen && (
              <div className="absolute inset-y-0 left-0 z-10 flex w-56 flex-col border-r border-black/10 bg-white/95 backdrop-blur-xl dark:bg-[#141a20]/95">
                <div className="flex items-center justify-between border-b border-black/5 px-3 py-2.5 dark:border-white/10">
                  <span className="text-xs font-bold">历史会话</span>
                  <span className="flex items-center gap-1">
                    <button title="导出当前对话为 Markdown" disabled={!sessionId || messages.length === 0}
                      className="rounded p-1 text-subtle hover:text-brand-600 disabled:opacity-30"
                      onClick={() => downloadText(
                        `aihub-助手会话-${sessionId}.md`,
                        messages.map((m) => `## ${m.role === 'user' ? '🙋 我' : '🤖 AI 助手'}\n\n${m.content}`).join('\n\n---\n\n'),
                      )}><FileDown size={14} /></button>
                    <button onClick={() => setHistoryOpen(false)}><X size={14} className="text-subtle" /></button>
                  </span>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                  {sessions.map((s) => (
                    <div key={s.id} className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs transition ${
                      sessionId === s.id ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15' : 'text-subtle hover:bg-black/5 dark:hover:bg-white/10'}`}>
                      {renaming?.id === s.id ? (
                        <input autoFocus className="input !px-1.5 !py-0.5 text-[11px]" value={renaming.title}
                          onChange={(e) => setRenaming({ id: s.id, title: e.target.value })}
                          onBlur={() => { renameSession(s.id, renaming.title); setRenaming(null) }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { renameSession(s.id, renaming.title); setRenaming(null) }
                            if (e.key === 'Escape') setRenaming(null)
                          }} />
                      ) : (
                        <button className="min-w-0 flex-1 truncate text-left disabled:opacity-40"
                          disabled={streaming} onClick={() => openSession(s.id)}>{s.title}</button>
                      )}
                      <button title="重命名" className="hidden rounded p-0.5 hover:text-brand-600 group-hover:block"
                        onClick={() => setRenaming({ id: s.id, title: s.title })}><Pencil size={10} /></button>
                      <button className="hidden rounded p-0.5 text-red-400 hover:bg-red-50 group-hover:block"
                        onClick={() => delSession(s.id)}><Trash2 size={10} /></button>
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="py-6 text-center text-[11px] text-gray-400">暂无历史会话</p>}
                </div>
              </div>
            )}

            {/* 消息区 */}
            <div ref={scrollBoxRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="pt-2">
                  {suggestions.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {suggestions.map((s) => (
                        <button key={s.id} className="w-full rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-left transition hover:border-brand-300 dark:border-brand-500/20 dark:bg-brand-500/10"
                          onClick={() => act(s)}>
                          <p className="text-xs font-bold text-brand-700 dark:text-brand-300">✦ {s.title}</p>
                          <p className="truncate text-[11px] text-subtle">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mb-3 text-center text-xs text-subtle">
                    问我任何问题，也可以让我直接帮你查资源、写笔记、生成简报
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {['帮我找一个能批量处理 Excel 的工具', '把这段总结成笔记：…', '今天有什么 AI 新资讯？'].map((p) => (
                      <button key={p} className="chip border border-black/10 bg-white/60 text-subtle transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-white/5"
                        onClick={() => doSend(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble key={i} m={m} streaming={streaming} isLast={i === messages.length - 1} />
              ))}

              {/* 写操作确认卡 */}
              {pendingConfirm && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="mb-1 flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                    <MessageCircle size={13} /> 需要你确认
                  </p>
                  <p className="mb-2 text-subtle">{pendingConfirm.question}</p>
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1 !py-1.5 text-xs" onClick={() => resolveConfirm(true)}>确认执行</button>
                    <button className="btn-ghost flex-1 !py-1.5 text-xs" onClick={() => resolveConfirm(false)}>取消</button>
                  </div>
                </div>
              )}

              {/* 结构化提问卡 */}
              {pendingAsk && (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/90 p-3 text-xs dark:border-brand-500/30 dark:bg-brand-500/10">
                  <p className="mb-1.5 font-bold text-brand-700 dark:text-brand-300">{pendingAsk.question}</p>
                  {pendingAsk.options.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {pendingAsk.options.map((o) => (
                        <button key={o} className="rounded-xl border border-brand-200 bg-white/80 px-3 py-1.5 text-left transition hover:border-brand-400 dark:bg-white/10"
                          onClick={() => answerAsk(o)}>{o}</button>
                      ))}
                    </div>
                  ) : (
                    <AskFreeText onAnswer={answerAsk} />
                  )}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 输入区 */}
            <div className="border-t border-black/5 p-3 dark:border-white/10">
              {pageContext && (
                <button className={`mb-2 flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] transition ${
                  usePageCtx ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-black/5 text-gray-400 dark:bg-white/10'
                }`}
                  onClick={togglePageCtx} title="点击切换：是否把当前页面作为上下文发给 AI">
                  {usePageCtx ? '📌' : '📍'} 上下文：{pageContext}
                </button>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  className="input max-h-24 min-h-[42px] flex-1 resize-none"
                  placeholder={streaming ? '生成中…' : '问点什么，Enter 发送'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() }
                  }}
                />
                {streaming ? (
                  <button className="btn border border-red-100 bg-red-50 !p-2.5 text-red-500" onClick={stop} title="停止生成">
                    <Square size={15} />
                  </button>
                ) : (
                  <button className="btn-primary !p-2.5" onClick={() => doSend()} disabled={!input.trim()} title="发送">
                    <Send size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* 右下角拖拽调大小手柄 */}
            <div
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize text-gray-400 transition hover:text-brand-500"
              title="拖拽调整面板大小"
              onMouseDown={startResize}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4">
                <path d="M14 14L8 14L14 8Z M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
