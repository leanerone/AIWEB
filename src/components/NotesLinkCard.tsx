import { useState } from 'react'
import { ExternalLink, Link2, Loader2, Mail } from 'lucide-react'
import { api } from '../services/api'
import { useToast } from './ui/Toast'
import type { NotesParsed } from '../types'

interface Props {
  /** 初始粘贴的原始文本（可选） */
  initialRaw?: string
  onSaved?: () => void
  compact?: boolean
}

/**
 * Notes 链接卡：粘贴 notes:// / NDL / 富文本 → 解析 → 信息卡 → 一键唤起 Notes 客户端
 */
export function NotesLinkCard({ initialRaw = '', onSaved, compact }: Props) {
  const [raw, setRaw] = useState(initialRaw)
  const [parsed, setParsed] = useState<NotesParsed | null>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const detect = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const data = await api.post<never, NotesParsed>('/notes/parse', { raw_text: text })
      setParsed(data)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const openInNotes = (url: string) => {
    // 借助 notes:// 协议处理器唤起本机 HCL Notes 客户端
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast('success', '已复制链接')
  }

  const save = async () => {
    try {
      await api.post('/notes/links', { raw_text: raw })
      toast('success', '已保存到链接库')
      setRaw('')
      setParsed(null)
      onSaved?.()
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  return (
    <div className={compact ? '' : 'rounded-bento border border-brand-100 bg-brand-50/40 p-4'}>
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="粘贴 notes:// 链接、NDL 或含链接的文本…"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && detect(raw)}
        />
        <button className="btn-primary shrink-0" onClick={() => detect(raw)} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          解析
        </button>
      </div>

      {parsed && (
        parsed.valid ? (
          <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-bento">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  📄 {parsed.title || parsed.document || '（未识别标题）'}
                </p>
                <div className="mt-1.5 grid grid-cols-1 gap-1 text-xs text-subtle sm:grid-cols-2">
                  {parsed.server && <span>🖥 服务器：{parsed.server}</span>}
                  {parsed.database && <span>🗂 数据库：{parsed.database}</span>}
                  {parsed.view && <span>👁 视图：{parsed.view}</span>}
                  {parsed.document && <span>📝 文档：{parsed.document}</span>}
                </div>
              </div>
              <Mail className="shrink-0 text-amber-500" size={20} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => openInNotes(parsed.url)}>
                <ExternalLink size={15} /> 在 Notes 中打开
              </button>
              <button className="btn-ghost" onClick={() => copy(parsed.url)}>复制链接</button>
              {!compact && (
                <button className="btn-ghost" onClick={save}>保存到链接库</button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-600">
            未识别到 Notes 链接：需要 notes:// 开头的链接或 Notes 客户端复制的 NDL 文本
          </p>
        )
      )}
    </div>
  )
}
