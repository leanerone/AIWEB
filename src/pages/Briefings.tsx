import { ChevronDown, Loader2, Newspaper, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { api } from '../services/api'
import { useList } from '../hooks/useList'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import type { BriefingItem } from '../types'

/** AI 简报归档：历次「每日简报」沉淀内容卡（ref_type=briefing），倒序分页 */
export function Briefings() {
  const toast = useToast()
  const [openId, setOpenId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const { items, total, page, setPage, loading, error, reload } = useList<BriefingItem>(
    ({ page, limit }) => api.get<never, { total: number; items: BriefingItem[] }>(
      `/hub/briefings?page=${page}&limit=${limit}`),
    [],
    20,
  )

  const gen = async () => {
    setGenerating(true)
    try {
      const d = await api.post<never, { title: string }>('/ai/briefing')
      toast('success', `已生成：${d.title}`)
      setPage(1)
      reload()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight">AI 简报</h1>
        <button className="btn-primary" onClick={gen} disabled={generating}
          title="抓取最新 RSS 资讯，AI 生成今日简报并归档到此">
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          生成今日简报
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-bento border border-gray-100 bg-white p-5 shadow-bento dark:border-gray-800 dark:bg-[#151823]">
              <div className="mb-3 h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
              <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className="py-10 text-center text-sm text-red-500">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <EmptyState icon={Newspaper} title="还没有简报"
          hint="先在「设置 → AI 资讯订阅」添加订阅源并刷新，然后点右上角生成本周第一份简报" />
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((b, i) => {
            const open = openId === b.id
            return (
              <BentoCard key={b.id} delay={Math.min(i * 0.04, 0.4)} className="p-0">
                <button className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  onClick={() => setOpenId(open ? null : b.id)}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15">
                    <Newspaper size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{b.title}</span>
                    <span className="block truncate text-xs text-subtle">
                      {b.created_by} · {b.created_at} · {b.summary}
                    </span>
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                    <MarkdownView text={b.content} />
                  </div>
                )}
              </BentoCard>
            )
          })}

          {items.length < total && (
            <div className="pt-1 text-center">
              <button className="btn-ghost" onClick={() => setPage(page + 1)}>加载更多（还有 {total - items.length} 份）</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
