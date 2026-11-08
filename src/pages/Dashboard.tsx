import { motion } from 'framer-motion'
import { ArrowUpRight, Bot, FileText, Loader2, Newspaper, Package, Puzzle, Sparkles, StickyNote, Trophy, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { StatCard } from '../components/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { timeAgo } from '../utils/time'
import type { Contributor, FeedItem, Stats } from '../types'

const KIND_META: Record<string, { label: string; cls: string }> = {
  ai: { label: 'AI 内容', cls: 'bg-violet-100 text-violet-700' },
  note: { label: '笔记', cls: 'bg-emerald-100 text-emerald-700' },
  announcement: { label: '公告', cls: 'bg-amber-100 text-amber-700' },
  resource: { label: '资源', cls: 'bg-brand-100 text-brand-700' },
  rss: { label: '资讯', cls: 'bg-sky-100 text-sky-700' },
}

export function Dashboard() {
  const user = useAuth((s) => s.user)
  const toast = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [kind, setKind] = useState('')
  const [limit, setLimit] = useState(25)
  const [loadingMore, setLoadingMore] = useState(false)
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [briefing, setBriefing] = useState(false)
  const [viewing, setViewing] = useState<FeedItem | null>(null)

  useEffect(() => {
    api.get<never, Stats>('/hub/stats').then(setStats).catch(() => {})
    api.get<never, Contributor[]>('/hub/contributors').then(setContributors).catch(() => {})
  }, [])

  useEffect(() => {
    setLoadingMore(true)
    api.get<never, FeedItem[]>(`/hub/feed?limit=${limit}`).then(setFeed).catch(() => {}).finally(() => setLoadingMore(false))
  }, [limit])

  const filtered = kind ? feed.filter((f) => f.kind === kind) : feed

  const genBriefing = async () => {
    setBriefing(true)
    try {
      const d = await api.post<never, { id: number; title: string }>('/ai/briefing')
      toast('success', `简报已生成：${d.title}`)
      setLoadingMore(true)
      api.get<never, FeedItem[]>(`/hub/feed?limit=${limit}`).then(setFeed).catch(() => {}).finally(() => setLoadingMore(false))
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBriefing(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="space-y-5">
      {/* 欢迎大卡 */}
      <BentoCard className="overflow-hidden">
        <div className="relative p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-100/70 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-violet-200/40 blur-2xl" />
          <div className="relative">
            <p className="text-sm text-subtle">
              {greeting}，{user?.display_name || user?.username} 👋
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              这是你的 <span className="gradient-text">AI 能力中枢</span>
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/resources" className="btn-primary"><Package size={15} /> 上传资源</Link>
              <Link to="/chat" className="btn-ghost"><Bot size={15} /> AI 对话</Link>
              <Link to="/memos" className="btn-ghost"><StickyNote size={15} /> 写笔记</Link>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* 统计 Bento 行 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Skills 技能包" value={stats?.skills ?? 0} to="/resources?type=skill" delay={0} />
        <StatCard icon={Wrench} label="小工具" value={stats?.tools ?? 0} to="/resources?type=tool" delay={0.06} tone="emerald" />
        <StatCard icon={Puzzle} label="插件" value={stats?.plugins ?? 0} to="/resources?type=plugin" delay={0.12} tone="amber" />
        <StatCard icon={StickyNote} label="笔记" value={stats?.memos ?? 0} to="/memos" delay={0.18} tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 动态 Feed */}
        <BentoCard className="lg:col-span-2" delay={0.1}>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-sm font-bold">最新动态</h2>
            <Link to="/resources" className="flex items-center text-xs text-brand-600 hover:underline">
              查看资源库 <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 px-5 pt-3">
            {[
              { key: '', label: '全部' },
              { key: 'ai', label: 'AI 内容' },
              { key: 'resource', label: '资源' },
              { key: 'note', label: '笔记' },
              { key: 'rss', label: '资讯' },
            ].map((t) => (
              <button key={t.key} onClick={() => setKind(t.key)}
                className={`chip border transition ${
                  kind === t.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-subtle hover:border-brand-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-1 p-3">
            {filtered.length === 0 && (
              <EmptyState icon={Sparkles} title="还没有动态"
                hint="上传第一个资源、写一篇笔记或让 AI 生成内容，这里就会热闹起来"
                action={<Link to="/resources" className="btn-primary">去上传资源</Link>} />
            )}
            {filtered.map((f, i) => {
              const meta = KIND_META[f.kind] ?? KIND_META.announcement
              const expandable = f.kind === 'ai' || f.kind === 'announcement'
              const href =
                f.kind === 'resource' ? `/resources/${f.id}`
                : f.kind === 'note' ? `/memos`
                : f.source_url || undefined
              const body = (
                <motion.div
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  onClick={expandable ? () => setViewing(f) : undefined}
                  className={`flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-gray-50 ${expandable ? 'cursor-pointer' : ''}`}
                >
                  <span className={`chip mt-0.5 shrink-0 ${meta.cls}`}>{meta.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{f.title}</p>
                    <p className="truncate text-xs text-subtle">{f.summary}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {f.created_by} · <span title={f.created_at}>{timeAgo(f.created_at)}</span>
                    </p>
                  </div>
                </motion.div>
              )
              if (expandable) return <div key={`${f.kind}-${f.id}-${i}`}>{body}</div>
              return href ? (
                <Link key={`${f.kind}-${f.id}-${i}`} to={href} className="block">{body}</Link>
              ) : (
                <div key={`${f.kind}-${f.id}-${i}`}>{body}</div>
              )
            })}
            {feed.length >= limit && (
              <div className="pt-2 text-center">
                <button className="btn-ghost" disabled={loadingMore}
                  onClick={() => setLimit((l) => l + 25)}>
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null} 加载更多
                </button>
              </div>
            )}
          </div>
        </BentoCard>

        {/* 右列：AI + RSS */}
        <div className="space-y-4">
          <BentoCard delay={0.16} onClick={() => (location.href = '/chat')} className="cursor-pointer">
            <div className="p-5">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundImage: 'var(--brand-grad)' }}>
                <Bot size={20} />
              </span>
              <h3 className="text-sm font-bold">AI 助手</h3>
              <p className="mt-1 text-xs leading-5 text-subtle">
                在线对话、生成周报素材与知识卡片，好内容可一键沉淀到首页动态
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                  开始对话 <ArrowUpRight size={13} />
                </span>
              </div>
              <button
                className="btn-ghost mt-3 w-full !text-xs"
                disabled={briefing}
                onClick={(e) => { e.stopPropagation(); genBriefing() }}
                title="抓取最新 RSS 资讯，AI 生成今日简报并沉淀到动态"
              >
                {briefing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                生成今日 AI 简报
              </button>
            </div>
          </BentoCard>

          <BentoCard delay={0.22} onClick={() => (location.href = '/settings')} className="cursor-pointer">
            <div className="p-5">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Newspaper size={20} />
              </span>
              <h3 className="text-sm font-bold">AI 资讯订阅</h3>
              <p className="mt-1 text-xs leading-5 text-subtle">
                已订阅 {stats?.rss_sources ?? 0} 个源 · {stats?.rss_items ?? 0} 条资讯
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sky-600">
                管理订阅 <ArrowUpRight size={13} />
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={0.28}>
            <div className="p-5">
              <h3 className="flex items-center gap-1.5 text-sm font-bold"><Trophy size={15} className="text-amber-500" /> 贡献者榜</h3>
              <div className="mt-3 space-y-2.5">
                {contributors.length === 0 && <p className="text-xs text-gray-400">还没有贡献记录</p>}
                {contributors.map((c) => (
                  <div key={c.user}>
                    <div className="flex justify-between text-xs">
                      <span className="truncate font-medium text-ink">{c.user}</span>
                      <span className="text-subtle">{c.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${c.percent}%`, backgroundImage: 'var(--brand-grad)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={0.31}>
            <div className="p-5">
              <h3 className="text-sm font-bold">近 7 天活跃</h3>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {(() => {
                  const days: { label: string; count: number }[] = []
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(Date.now() - i * 86400000)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    const count = feed.filter((f) => f.created_at.startsWith(key)).length
                    days.push({ label: key, count })
                  }
                  const max = Math.max(1, ...days.map((d) => d.count))
                  return days.map((d) => (
                    <div key={d.label} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count} 条`}>
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t-md transition-all" style={{
                          height: `${Math.max(6, (d.count / max) * 100)}%`,
                          backgroundImage: d.count ? 'var(--brand-grad)' : undefined,
                          backgroundColor: d.count ? undefined : 'rgba(107,114,128,.25)',
                        }} />
                      </div>
                      <span className="text-[9px] text-gray-400">{d.label.slice(-2)}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={0.34}>
            <div className="p-5">
              <h3 className="text-sm font-bold">平台统计</h3>
              <ul className="mt-3 space-y-2 text-xs text-subtle">
                <li className="flex justify-between"><span>AI 内容卡</span><b className="text-ink">{stats?.cards ?? 0}</b></li>
                <li className="flex justify-between"><span>AI 对话会话</span><b className="text-ink">{stats?.chats ?? 0}</b></li>
                <li className="flex justify-between"><span>资讯条目</span><b className="text-ink">{stats?.rss_items ?? 0}</b></li>
              </ul>
            </div>
          </BentoCard>
        </div>
      </div>

      {/* 内容卡全文弹窗 */}
      {viewing && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
          onClick={() => setViewing(null)}>
          <div className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-bento2 bg-white p-6 shadow-bentoHover"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className={`chip ${KIND_META[viewing.kind]?.cls ?? KIND_META.announcement.cls}`}>
                  {KIND_META[viewing.kind]?.label}
                </span>
                <h2 className="mt-2 text-lg font-bold tracking-tight">{viewing.title}</h2>
                <p className="text-xs text-gray-400">{viewing.created_by} · {viewing.created_at}</p>
              </div>
              <button className="rounded-lg p-1.5 text-subtle hover:bg-gray-100" onClick={() => setViewing(null)}>✕</button>
            </div>
            {viewing.source_url && (
              <a href={viewing.source_url} target="_blank" rel="noreferrer"
                className="mb-3 block truncate text-xs text-brand-600 hover:underline">
                {viewing.source_url}
              </a>
            )}
            <MarkdownView text={viewing.content || viewing.summary} />
          </div>
        </div>
      )}
    </div>
  )
}
