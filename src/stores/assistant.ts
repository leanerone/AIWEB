import { create } from 'zustand'
import { api } from '../services/api'
import type { ChatSessionItem } from '../types'

/** Agent 工具轨迹步骤（任务卡数据源） */
export interface AgentStep {
  tool: string
  summary: string
  ok: boolean
  ts: string
}

export interface RecommendCard {
  id: number
  name: string
  type: string
  summary: string
  license?: string
}

export interface AssistantMsg {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
  meta?: { steps?: AgentStep[]; recommendations?: RecommendCard[] }
}

export interface PendingConfirm {
  runId: number
  tool: string
  question: string
  digest: string
}

export interface PendingAsk {
  runId: number
  question: string
  options: string[]
}

interface AssistantState {
  open: boolean
  sessionId: number | null
  sessions: ChatSessionItem[]
  messages: AssistantMsg[]
  streaming: boolean
  historyOpen: boolean
  usePageContext: boolean
  pageContext: string
  pendingConfirm: PendingConfirm | null
  pendingAsk: PendingAsk | null
  badge: number
  suggestions: { id: string; title: string; desc: string; action: string; ref?: string }[]
  loadSuggestions: () => void

  setOpen: (v: boolean) => void
  toggle: () => void
  setHistoryOpen: (v: boolean) => void
  togglePageContext: () => void
  setPageContext: (label: string) => void
  loadSessions: () => void
  openSession: (id: number | null) => void
  send: (text: string) => void
  stop: () => void
  regenerate: () => void
  resolveConfirm: (approved: boolean) => void
  answerAsk: (answer: string) => void
  delSession: (id: number) => void
  renameSession: (id: number, title: string) => void
  saveCard: (content: string) => Promise<void>
}

let abortRef: AbortController | null = null

/** 解析 SSE 字节流为事件块（共享给 send / resume 两条路径） */
async function consume(
  resp: Response,
  onEvent: (event: string, data: any) => void,
): Promise<void> {
  if (!resp.body) throw new Error('无响应体')
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
      try {
        onEvent(evLine.slice(6).trim(), JSON.parse(dataLine.slice(5)))
      } catch { /* 跳过坏块 */ }
    }
  }
}

export const useAssistant = create<AssistantState>((set, get) => {
  /** 追加/更新末尾助手消息的通用工具 */
  const patchLast = (fn: (m: AssistantMsg) => AssistantMsg) =>
    set((s) => {
      const copy = [...s.messages]
      if (!copy.length) return s
      copy[copy.length - 1] = fn(copy[copy.length - 1])
      return { messages: copy }
    })

  const addStep = (step: AgentStep) =>
    patchLast((m) => ({
      ...m,
      meta: { ...m.meta, steps: [...(m.meta?.steps ?? []), step] },
    }))

  /** 发起 SSE 请求并消费事件流（send 与 resume 共用） */
  const run = async (url: string, body: Record<string, unknown>) => {
    const controller = new AbortController()
    abortRef = controller
    set({ streaming: true })
    let gotMeta = false
    try {
      const token = localStorage.getItem('aiweb_token')
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${resp.status}`)
      }
      await consume(resp, (event, data) => {
        switch (event) {
          case 'meta':
            gotMeta = true
            if (data.session_id && data.session_id !== get().sessionId) {
              set({ sessionId: data.session_id })
              try { localStorage.setItem('aiweb_assistant_session', String(data.session_id)) } catch { /* 忽略 */ }
              get().loadSessions()
            }
            break
          case 'delta':
            patchLast((m) => ({ ...m, content: m.content + (data.text || '') }))
            break
          case 'step':
            addStep({ tool: data.tool, summary: data.summary, ok: data.ok !== false, ts: data.ts || '' })
            break
          case 'confirm':
            // 挂起时清掉空占位气泡（恢复后会有新气泡承接）
            set((s) => {
              const copy = [...s.messages]
              const last = copy[copy.length - 1]
              if (last && last.role === 'assistant' && !last.content && !(last.meta?.steps ?? []).length) copy.pop()
              return { messages: copy, pendingConfirm: { runId: data.run_id, tool: data.tool, question: data.question, digest: data.digest } }
            })
            break
          case 'ask':
            set((s) => {
              const copy = [...s.messages]
              const last = copy[copy.length - 1]
              if (last && last.role === 'assistant' && !last.content && !(last.meta?.steps ?? []).length) copy.pop()
              return { messages: copy, pendingAsk: { runId: data.run_id, question: data.question, options: data.options || [] } }
            })
            break
          case 'error':
            gotMeta = true
            patchLast((m) => ({ ...m, content: m.content || `⚠️ ${data.message}` }))
            break
          case 'done': {
            const recs = (data.recommendations || []) as RecommendCard[]
            if (data.reply !== undefined) {
              patchLast((m) => ({
                ...m,
                content: data.reply || m.content,
                meta: { ...(m.meta ?? {}), ...(data.steps ? { steps: data.steps } : {}), ...(recs.length ? { recommendations: recs } : {}) },
              }))
            }
            set({ pendingConfirm: null, pendingAsk: null })
            break
          }
        }
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).message
        // meta 之前失败 = 服务端未落库，回滚乐观气泡
        if (!gotMeta) {
          set((s) => {
            const copy = [...s.messages]
            if (copy.length >= 2 && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
              copy.splice(-2)
            }
            return { messages: copy }
          })
          throw new Error(msg) // 让调用方 toast
        }
        patchLast((m) => ({ ...m, content: m.content || `⚠️ ${msg}` }))
      }
    } finally {
      set({ streaming: false })
      abortRef = null
    }
  }

  return {
    open: false,
    sessionId: null,
    sessions: [],
    messages: [],
    streaming: false,
    historyOpen: false,
    usePageContext: true,
    pageContext: '',
    pendingConfirm: null,
    pendingAsk: null,
    badge: 0,
    suggestions: [],

    loadSuggestions: () =>
      api.get<never, { items: AssistantState['suggestions'] }>('/assistant/suggestions')
        .then((d) => set({ suggestions: d.items, badge: d.items.length }))
        .catch(() => {}),

    setOpen: (v) => set({ open: v, historyOpen: v ? get().historyOpen : false }),
    toggle: () => set((s) => ({ open: !s.open })),
    setHistoryOpen: (v) => set({ historyOpen: v }),
    togglePageContext: () => set((s) => ({ usePageContext: !s.usePageContext })),
    setPageContext: (label) => set({ pageContext: label }),

    loadSessions: () =>
      api.get<never, ChatSessionItem[]>('/chat/sessions').then((sessions) => set({ sessions })).catch(() => {}),

    openSession: (id) => {
      if (get().streaming) return // 流式中切换会把后续 token 写进新会话视图，禁止
      set({ sessionId: id, historyOpen: false, pendingConfirm: null, pendingAsk: null })
      try { localStorage.setItem('aiweb_assistant_session', id ? String(id) : '') } catch { /* 忽略 */ }
      if (!id) { set({ messages: [] }); return }
      api.get<never, AssistantMsg[]>(`/chat/sessions/${id}/messages`)
        .then((messages) => set({ messages }))
        .catch(() => set({ messages: [] }))
    },

    send: (text) => {
      const state = get()
      if (state.streaming || !text.trim()) return
      if (state.pendingConfirm || state.pendingAsk) return // 挂起任务未决时不开新请求
      const pageCtx = state.usePageContext ? state.pageContext : ''
      set((s) => ({
        messages: [...s.messages, { role: 'user', content: text.trim() }, { role: 'assistant', content: '' }],
        historyOpen: false,
      }))
      // 助手统一走 Agent 通道（工具循环 + 确认卡）；/api/chat/completions 仅保留给重新生成
      run('/api/agent/run', {
        session_id: state.sessionId,
        message: text.trim(),
        page_context: pageCtx || null,
      }).catch((e) => console.warn(e.message))
    },

    stop: () => abortRef?.abort(),

    regenerate: () => {
      const state = get()
      if (state.streaming || !state.sessionId) return
      set((s) => {
        const copy = [...s.messages]
        while (copy.length && copy[copy.length - 1].role === 'assistant') copy.pop()
        return copy.length ? { messages: [...copy, { role: 'assistant', content: '' }] } : s
      })
      // 助手回答都出自 Agent 循环，重新生成同样走 Agent 通道（保留工具上下文）
      run('/api/agent/run', { session_id: state.sessionId, regenerate: true })
        .catch((e) => console.warn(e.message))
    },

    resolveConfirm: (approved) => {
      const c = get().pendingConfirm
      if (!c || get().streaming) return
      set({ pendingConfirm: null, historyOpen: false })
      set((s) => ({ messages: [...s.messages, { role: 'assistant', content: '' }] }))
      run('/api/agent/resume', { run_id: c.runId, approved }).catch((e) => console.warn(e.message))
    },

    answerAsk: (answer) => {
      const a = get().pendingAsk
      if (!a || get().streaming || !answer.trim()) return
      set({ pendingAsk: null, historyOpen: false })
      // 用户回答 + 空 assistant 气泡：resume 的 delta/done 要写到助手气泡，不能并进用户气泡
      set((s) => ({ messages: [...s.messages, { role: 'user', content: answer.trim() }, { role: 'assistant', content: '' }] }))
      run('/api/agent/resume', { run_id: a.runId, answer: answer.trim() }).catch((e) => console.warn(e.message))
    },

    delSession: (id) => {
      api.delete(`/chat/sessions/${id}`)
        .then(() => {
          if (get().sessionId === id) set({ sessionId: null, messages: [] })
          get().loadSessions()
        })
        .catch(() => {})
    },

    renameSession: (id, title) => {
      if (!title.trim()) return
      api.put(`/chat/sessions/${id}`, { title: title.trim() })
        .then(() => set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, title: title.trim() } : x)) })))
        .catch(() => {})
    },

    saveCard: async (content) => {
      const sid = get().sessionId
      if (!sid) throw new Error('请先发起对话')
      await api.post(`/chat/sessions/${sid}/save-card`, { content })
    },
  }
})
