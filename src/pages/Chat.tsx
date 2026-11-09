import { BookMarked, Copy, FileDown, Loader2, Pencil, Plus, RotateCcw, Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { downloadText } from '../utils/time'
import type { ChatMsg, ChatSessionItem, Resource } from '../types'

export function Chat() {
  const toast = useToast()
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [contextRes, setContextRes] = useState<Resource | null>(null)
  const [allResources, setAllResources] = useState<Resource[]>([])
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null)

  useEffect(() => {
    api.get<never, { items: Resource[] }>('/resources?limit=100').then((d) => setAllResources(d.items)).catch(() => {})
  }, [])

  const loadSessions = () => api.get<never, ChatSessionItem[]>('/chat/sessions').then(setSessions).catch(() => {})
  useEffect(() => { loadSessions() }, [])

  useEffect(() => {
    if (sessionId) {
      api.get<never, ChatMsg[]>(`/chat/sessions/${sessionId}/messages`).then(setMessages).catch(() => {})
    } else {
      setMessages([])
    }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (textOverride?: string, opts?: { regenerate?: boolean }) => {
    const regenerate = opts?.regenerate === true
    const text = (textOverride ?? input).trim()
    if ((!text && !regenerate) || streaming) return
    if (!regenerate) setInput('')
    setStreaming(true)
    if (regenerate) {
      // 重新生成：去掉末尾旧的助手回答，追加一个空气泡
      setMessages((m) => {
        const copy = [...m]
        while (copy.length && copy[copy.length - 1].role === 'assistant') copy.pop()
        return copy.length ? [...copy, { role: 'assistant', content: '' }] : copy
      })
    } else {
      setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    }
    const controller = new AbortController()
    abortRef.current = controller
    let gotMeta = false // meta 之前失败 = 服务端未落库，需要回滚本地乐观气泡

    try {
      const token = localStorage.getItem('aiweb_token')
      const resp = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          context_resource_id: contextRes?.id ?? null,
          regenerate,
        }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() ?? ''
        for (const block of blocks) {
          const evLine = block.split('\n').find((l) => l.startsWith('event:'))
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'))
          if (!evLine || !dataLine) continue
          const event = evLine.slice(6).trim()
          const data = JSON.parse(dataLine.slice(5))
          if (event === 'meta') {
            gotMeta = true
            setSessionId(data.session_id)
            loadSessions()
          } else if (event === 'delta') {
            setMessages((m) => {
              const copy = [...m]
              copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + data.text }
              return copy
            })
          } else if (event === 'error') {
            gotMeta = true
            toast('error', data.message)
            setMessages((m) => {
              const copy = [...m]
              copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${data.message}` }
              return copy
            })
          } else if (event === 'done') {
            setMessages((m) => {
              const copy = [...m]
              copy[copy.length - 1] = { role: 'assistant', content: data.reply || copy[copy.length - 1].content }
              return copy
            })
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // 主动停止：保留已生成部分
      } else {
        toast('error', (e as Error).message)
        // 服务端未落库（meta 之前失败）：回滚本轮乐观气泡
        if (!gotMeta) {
          setMessages((m) => (regenerate
            ? (m[m.length - 1]?.role === 'assistant' && !m[m.length - 1].content ? m.slice(0, -1) : m)
            : m.slice(0, -2)))
        }
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const regenerate = () => send(undefined, { regenerate: true })

  const stop = () => abortRef.current?.abort()

  const copyMsg = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast('success', '已复制')
  }

  const saveCard = async (content: string) => {
    if (!sessionId) return
    try {
      await api.post(`/chat/sessions/${sessionId}/save-card`, { content })
      toast('success', '已沉淀为首页内容卡')
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const delSession = async (id: number) => {
    try {
      await api.delete(`/chat/sessions/${id}`)
      if (sessionId === id) setSessionId(null)
      loadSessions()
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const renameSession = async (id: number, title: string) => {
    if (!title.trim()) { setRenaming(null); return }
    try {
      await api.put(`/chat/sessions/${id}`, { title: title.trim() })
      setSessions((list) => list.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)))
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setRenaming(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* 会话列表 */}
      <BentoCard className="hidden h-fit p-3 lg:block" delay={0}>
        <button className="btn-primary mb-2 w-full" onClick={() => setSessionId(null)}>
          <Plus size={15} /> 新对话
        </button>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {sessions.map((s) => (
            <div key={s.id}
              className={`group flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm transition ${
                sessionId === s.id ? 'bg-brand-50 text-brand-700' : 'text-subtle hover:bg-gray-50'
              }`}>
              {renaming?.id === s.id ? (
                <input autoFocus className="input !px-2 !py-1 text-xs" value={renaming.title}
                  onChange={(e) => setRenaming({ id: s.id, title: e.target.value })}
                  onBlur={() => renameSession(s.id, renaming.title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameSession(s.id, renaming.title)
                    if (e.key === 'Escape') setRenaming(null)
                  }} />
              ) : (
                <>
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => setSessionId(s.id)}>{s.title}</button>
                  <button title="重命名" className="hidden shrink-0 rounded p-1 text-subtle hover:text-brand-600 group-hover:block"
                    onClick={() => setRenaming({ id: s.id, title: s.title })}><Pencil size={12} /></button>
                </>
              )}
              <button className="hidden shrink-0 rounded p-1 text-red-400 hover:bg-red-50 group-hover:block"
                onClick={() => delSession(s.id)}><Trash2 size={13} /></button>
            </div>
          ))}
          {sessions.length === 0 && <p className="px-2 py-4 text-center text-xs text-gray-400">暂无历史会话</p>}
        </div>
      </BentoCard>

      {/* 对话区 */}
      <BentoCard className="flex min-h-[70vh] flex-col p-0" delay={0.06}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <span className="text-xs text-subtle">
            {sessionId ? `会话 #${sessionId}` : '新对话'}
          </span>
          {messages.length > 0 && (
            <button className="flex items-center gap-1 text-xs text-subtle hover:text-brand-600"
              onClick={() => downloadText(
                `aihub-对话-${sessionId ?? 'draft'}.md`,
                messages.map((m) => `## ${m.role === 'user' ? '🙋 我' : '🤖 AI'}\n\n${m.content}`).join('\n\n---\n\n'),
              )}>
              <FileDown size={13} /> 导出对话
            </button>
          )}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <>
              <EmptyState icon={Sparkles} title="开始与 AI 对话"
                hint="配置好 AI Key 后即可流式对话；好回复可一键沉淀为首页内容卡"
                action={<button className="btn-ghost" onClick={() => (location.href = '/settings')}>去配置 AI</button>} />
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {['用大白话解释 EAP 是什么', '帮我写一份周报模板', '机台通信超时怎么排查？', '总结今天的 AI 资讯要点'].map((p) => (
                  <button key={p} className="chip border border-gray-200 bg-white text-subtle transition hover:border-brand-300 hover:text-brand-600"
                    onClick={() => send(p)}>{p}</button>
                ))}
              </div>
            </>
          )}
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1
            const inProgress = m.role === 'assistant' && isLast && streaming
            return (
              <div key={i} className={`group flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  m.role === 'user'
                    ? 'text-white shadow-bento [background-image:var(--brand-grad)]'
                    : 'bg-gray-50 text-ink dark:bg-dark-card'
                }`}>
                  {m.role === 'assistant'
                    ? (inProgress
                        ? (m.content || <Loader2 size={14} className="animate-spin inline" />)
                        : <MarkdownView text={m.content} />)
                    : m.content}
                  {m.role === 'assistant' && !streaming && m.content && !m.content.startsWith('⚠️') && (
                    <div className="mt-2 flex justify-end gap-3 border-t border-gray-200/70 pt-2">
                      <button className="flex items-center gap-1 text-[11px] text-subtle hover:text-brand-600"
                        onClick={() => copyMsg(m.content)}>
                        <Copy size={11} /> 复制
                      </button>
                      {isLast && sessionId && (
                        <button className="flex items-center gap-1 text-[11px] text-subtle hover:text-brand-600"
                          title="对上一条提问重新生成回答"
                          onClick={regenerate}>
                          <RotateCcw size={11} /> 重新生成
                        </button>
                      )}
                      <button className="text-[11px] text-brand-600 hover:underline" onClick={() => saveCard(m.content)}>
                        ✦ 沉淀为内容卡
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-100 p-4">
          {contextRes && (
            <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
              <BookMarked size={12} className="shrink-0" />
              <span className="max-w-[240px] truncate">引用：{contextRes.name}</span>
              <button onClick={() => setContextRes(null)}><X size={12} /></button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              className="input max-h-32 min-h-[46px] flex-1 resize-none"
              placeholder="输入消息，Enter 发送 / Shift+Enter 换行"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
            />
            <select
              className="input w-10 shrink-0 cursor-pointer p-0 text-center"
              title="引用一个资源作为对话上下文"
              value=""
              onChange={(e) => {
                const r = allResources.find((x) => x.id === Number(e.target.value))
                if (r) setContextRes(r)
              }}
            >
              <option value="">📎</option>
              {allResources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              className={streaming ? 'btn self-end bg-red-50 text-red-500 border border-red-100' : 'btn-primary self-end'}
              onClick={streaming ? stop : () => send()}
              disabled={!streaming && !input.trim()}
            >
              {streaming ? <><Square size={14} /> 停止</> : <Send size={16} />}
            </button>
          </div>
        </div>
      </BentoCard>
    </div>
  )
}
