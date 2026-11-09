import { Star } from 'lucide-react'
import type { MouseEvent } from 'react'
import { api } from '../services/api'
import { useToast } from './ui/Toast'

/** 收藏星标（乐观 toggle），资源与笔记通用 */
export function BookmarkButton({ targetType, targetId, bookmarked, onToggle, size = 14, withText = false }: {
  targetType: 'resource' | 'memo'
  targetId: number
  bookmarked: boolean
  onToggle?: (bookmarked: boolean) => void
  size?: number
  withText?: boolean
}) {
  const toast = useToast()
  const toggle = async (e?: MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    try {
      const d = await api.post<never, { bookmarked: boolean }>('/bookmarks/toggle',
        { target_type: targetType, target_id: targetId })
      onToggle?.(d.bookmarked)
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }
  return (
    <button onClick={toggle}
      className={`flex items-center gap-1 transition ${bookmarked ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
      title={bookmarked ? '取消收藏' : '收藏'}>
      <Star size={size} fill={bookmarked ? 'currentColor' : 'none'} />
      {withText && <span className="text-[11px]">{bookmarked ? '已收藏' : '收藏'}</span>}
    </button>
  )
}
