import { Mail } from 'lucide-react'
import { useMemo } from 'react'

/** 从文本中提取 notes:// 链接并渲染成可唤起 Notes 客户端的行内卡片 */
export function NotesInlineLinks({ text }: { text: string }) {
  const links = useMemo(() => {
    const found = (text || '').match(/notes:\/\/[^\s"'<>）)\]]+/g) ?? []
    return Array.from(new Set(found))
  }, [text])

  if (links.length === 0) return null

  const label = (url: string) => {
    try {
      const u = url.replace(/^notes:\/\//, '')
      const [server, ...segs] = u.split('/')
      const tail = segs.filter(Boolean).slice(-2).join(' / ')
      return `${server}${tail ? ' · ' + tail : ''}`
    } catch {
      return url.slice(0, 60)
    }
  }

  const openInNotes = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
      {links.map((l) => (
        <div key={l} className="flex items-center gap-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs">
          <Mail size={12} className="shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1 truncate text-amber-700" title={l}>{label(l)}</span>
          <button className="shrink-0 font-medium text-amber-600 hover:underline"
            onClick={() => openInNotes(l)}>在 Notes 打开</button>
        </div>
      ))}
    </div>
  )
}
