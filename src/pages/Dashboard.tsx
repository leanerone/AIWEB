import {
  ArrowUpRight, Bot, Check, Copy, Download, FileText, Flame, Heart,
  Loader2, Newspaper, Package, Search, Send,
  Sparkles, Star, Trash2, Trophy,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAssistant } from '../stores/assistant'
import { useAuth } from '../stores/auth'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { timeAgo } from '../utils/time'
import type { Contributor, FeedItem, Resource, Stats } from '../types'

/* ── 元数据表 ── */
const TYPE_META: Record<string, { label: string; dot: string; chip: string }> = {
  skill: { label: 'Skill', dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700' },
  tool: { label: '工具', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  plugin: { label: '插件', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
}
const KIND_META: Record<string, { label: string; cls: string }> = {
  ai: { label: 'AI 内容', cls: 'bg-brand-100 text-brand-700' },
  note: { label: '笔记', cls: 'bg-gray-100 text-gray-600' },
  announcement: { label: '公告', cls: 'bg-gray-100 text-gray-600' },
  resource: { label: '资源', cls: 'bg-gray-100 text-gray-600' },
  rss: { label: '资讯', cls: 'bg-gray-100 text-gray-600' },
}

/** 复制给 AI 的安装指令 */
const installPrompt = (name: string) =>
  `请帮我从公司内网 AI Hub 安装/使用「${name}」，先告诉我它解决什么问题、怎么用。`

export function Dashboard() {
  const user = useAuth((s) => s.user)
  const toast = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [resList, setResList] = useState<Resource[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [resType, setResType] = useState('')
  const [rankTab, setRankTab] = useState<'downloads' | 'likes' | 'new'>('downloads')
  const [briefing, setBriefing] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<FeedItem | null>(null)
  const [feedLoading, setFeedLoading] = useState(true)

  useEffect(() => {
    api.get<never, Stats>('/hub/stats').then(setStats).catch(() => {})
    api.get<never, Contributor[]>('/hub/contributors').then(setContributors).catch(() => {})
    api.get<never, { items: Resource[] }>('/resources?order=downloads&limit=24')
      .then((d) => setResList(d.items)).catch(() => {})
    setFeedLoading(true)
    api.get<never, FeedItem[]>('/hub/feed?limit=10').then(setFeed).catch(() => {}).finally(() => setFeedLoading(false))
  }, [])

  // 类型切换走服务端取数（资源超过 24 条时客户端过滤会漏）
  useEffect(() => {
    api.get<never, { items: Resource[] }>(`/resources?order=downloads&limit=9${resType ? `&type=${resType}` : ''}`)
      .then((d) => setResList(d.items)).catch(() => {})
  }, [resType])

  const filtered = useMemo(() => resList, [resList])
  const ranking = useMemo(() => {
    const arr = [...resList]
    if (rankTab === 'likes') arr.sort((a, b) => b.likes - a.likes || b.downloads - a.downloads)
    else if (rankTab === 'new') arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else arr.sort((a, b) => b.downloads - a.downloads || b.likes - a.likes)
    return arr.slice(0, 6)
  }, [resList, rankTab])

  const askAssistant = (text: string) => {
    const st = useAssistant.getState()
    st.setOpen(true)
    window.setTimeout(() => st.send(text), 80)
  }
  const copyInstall = async (r: Resource) => {
    try {
      await navigator.clipboard.writeText(installPrompt(r.name))
      setCopiedId(r.id)
      toast('success', '安装指令已复制，粘贴给 AI 即可')
      window.setTimeout(() => setCopiedId((c) => (c === r.id ? null : c)), 1800)
    } catch { toast('error', '复制失败，请手动选取') }
  }
  const genBriefing = async () => {
    setBriefing(true)
    try {
      const d = await api.post<never, { title: string }>('/ai/briefing')
      toast('success', `简报已生成：${d.title}`)
      api.get<never, FeedItem[]>('/hub/feed?limit=10').then(setFeed).catch(() => {})
    } catch (e) { toast('error', (e as Error).message) }
    finally { setBriefing(false) }
  }

  const hour = new Date().getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'

  const QUICK = [
    '帮我找一个能批量处理 Excel 的技能',
    '把本周工作项整理成周报初稿',
    '有哪些 EAP 排障相关的笔记',
    '生成今日 AI 简报',
  ]

  return (
    <div className="space-y-14 pb-4">
      {/* ═══ 居中 Hero ═══ */}
      <section className="pt-4 text-center sm:pt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-subtle shadow-sm">
          <Sparkles size={12} className="text-brand-500" /> 内网 AI 分享平台 · Skills / 工具 / 插件 / 笔记
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          {greeting}，{user?.display_name || user?.username}
          <br />
          让团队的能力 <span className="gradient-text">可复用</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-subtle">
          发现并安装同事沉淀的技能与工具，AI 助手帮你查资料、写笔记、生成简报——一个入口全搞定。
        </p>

        {/* 搜索胶囊（唤起 ⌘K）——纯 CSS 焦点玻璃，圆角干净、无滤镜卡顿 */}
        <div
          className="glass-focal lg-edge mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:shadow-bentoHover">
          <button
            className="flex flex-1 items-center gap-3 text-sm text-gray-400"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
          >
            <Search size={16} /> 搜索资源、笔记、资讯…
          </button>
          <Link to="/resources" className="btn-primary !py-1.5 text-xs">浏览资源库</Link>
        </div>

        {/* 快捷指令 chips */}
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => askAssistant(q)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-subtle transition hover:border-brand-400 hover:text-brand-600">
              <Send size={11} className="text-brand-500" /> {q}
            </button>
          ))}
        </div>

        {/* 统计数字：焦点玻璃面板（纯 CSS，圆角干净、无持久折射滤镜） */}
        <div className="glass-focal lg-edge mx-auto mt-8 flex max-w-2xl items-center justify-center gap-6 rounded-bento px-8 py-5 sm:gap-10">
          {[
            { k: 'Skills', v: stats?.skills ?? 0 },
            { k: '工具', v: stats?.tools ?? 0 },
            { k: '插件', v: stats?.plugins ?? 0 },
            { k: '笔记', v: stats?.memos ?? 0 },
          ].map((s) => (
            <div key={s.k} className="text-center">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-brand-600">{s.v}</div>
              <div className="mt-0.5 text-xs text-subtle">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 冷启动引导 */}
      {stats && stats.skills + stats.tools + stats.plugins === 0 && (
        <section className="mx-auto max-w-2xl">
          <BentoCard className="p-5 text-center">
            <p className="text-sm font-bold text-ink">从上传第一个资源开始</p>
            <p className="mt-1 text-xs leading-5 text-subtle">
              把你的 SKILL.md 技能包、脚本或插件传上来（支持拖拽自动识别），全组就能搜索、安装、复用
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Link to="/resources" className="btn-primary !py-1.5 text-xs">去上传</Link>
              <Link to="/settings" className="btn-ghost !py-1.5 text-xs">先配置我的 AI Key</Link>
            </div>
          </BentoCard>
        </section>
      )}

      {/* ═══ 发现好资源 ═══ */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">发现好资源</h2>
            <p className="mt-1 text-sm text-subtle">按下载量排序的热门技能、工具与插件</p>
          </div>
          <Link to="/resources" className="hidden items-center gap-1 text-sm text-brand-600 hover:underline sm:flex">
            全部资源 <ArrowUpRight size={14} />
          </Link>
        </div>
        {/* 类型筛选 */}
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: '', label: '全部' },
            { key: 'skill', label: 'Skills' },
            { key: 'tool', label: '小工具' },
            { key: 'plugin', label: '插件' },
          ].map((t) => (
            <button key={t.key} onClick={() => setResType(t.key)}
              className={`chip border px-3 py-1.5 text-sm transition ${
                resType === t.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-subtle hover:border-brand-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <BentoCard>
            <EmptyState icon={Package} title="还没有资源"
              hint="上传 SKILL.md 技能包、脚本或插件，供团队取用"
              action={<Link to="/resources" className="btn-primary"><FileText size={15} /> 去上传</Link>} />
          </BentoCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, 9).map((r, i) => {
              const meta = TYPE_META[r.type] ?? TYPE_META.skill
              return (
                <BentoCard key={r.id} className="p-0" delay={Math.min(i * 0.03, 0.2)}>
                  <div className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between">
                      <span className={`chip ${meta.chip}`}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400"><Download size={12} />{r.downloads}</span>
                    </div>
                    <h3 className="mt-3 truncate text-[15px] font-bold text-ink">{r.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-subtle">
                      {r.summary || r.content.slice(0, 60) || '（暂无简介）'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.tags.slice(0, 3).map((t) => <span key={t} className="chip bg-gray-100 text-gray-600">#{t}</span>)}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="truncate text-[11px] text-gray-400">{r.created_by}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyInstall(r)} title="复制给 AI 的安装指令"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-subtle transition hover:border-brand-400 hover:text-brand-600">
                          {copiedId === r.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          {copiedId === r.id ? '已复制' : '安装'}
                        </button>
                        <Link to={`/resources/${r.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50">
                          详情 <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </BentoCard>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ 热门资源榜 ═══ */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
            <Flame size={20} className="text-brand-500" /> 热门资源榜
          </h2>
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 text-sm">
            {([['downloads', '下载榜'], ['likes', '点赞榜'], ['new', '最新']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setRankTab(k)}
                className={`rounded-lg px-3 py-1 font-medium transition ${rankTab === k ? 'bg-brand-50 text-brand-700' : 'text-subtle hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* 冠军卡 */}
          {ranking[0] && (
            <BentoCard className="p-0 lg:col-span-2">
              <div className="flex h-full flex-col justify-between bg-brand-50/60 p-6 dark:bg-brand-50/10">
                <div>
                  <span className="chip bg-brand-600 text-white">No.1</span>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink">{ranking[0].name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-subtle">
                    {ranking[0].summary || ranking[0].content.slice(0, 120)}
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-4 text-sm text-subtle">
                  <span className="flex items-center gap-1"><Download size={14} />{ranking[0].downloads}</span>
                  <span className="flex items-center gap-1"><Heart size={14} />{ranking[0].likes}</span>
                  <span className="text-gray-400">{ranking[0].created_by}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/resources/${ranking[0].id}`} className="btn-primary flex-1">查看资源</Link>
                  <button onClick={() => copyInstall(ranking[0])} className="btn-ghost">
                    {copiedId === ranking[0].id ? <Check size={15} /> : <Copy size={15} />} 复制指令
                  </button>
                </div>
              </div>
            </BentoCard>
          )}
          {/* 2-6 名列表 */}
          <BentoCard className="p-0 lg:col-span-3">
            <ul className="divide-y divide-gray-100">
              {ranking.slice(1).map((r, i) => {
                const meta = TYPE_META[r.type] ?? TYPE_META.skill
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-gray-400">{i + 2}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <Link to={`/resources/${r.id}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink hover:text-brand-600">{r.name}</span>
                      <span className="block truncate text-xs text-gray-400">{r.summary || '（暂无简介）'}</span>
                    </Link>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-subtle sm:flex"><Download size={12} />{r.downloads}</span>
                    <button onClick={() => copyInstall(r)} title="复制给 AI 的安装指令"
                      className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-subtle transition hover:border-brand-400 hover:text-brand-600">
                      {copiedId === r.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </BentoCard>
        </div>
      </section>

      {/* ═══ 深色信息带：AI 每日简报 ═══ */}
      <section className="hub-band rounded-bento2 px-7 py-8 sm:px-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-lg">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
              <Newspaper size={12} /> AI 每日简报
            </div>
            <h2 className="text-xl font-bold tracking-tight">每天自动抓取 AI 资讯，生成中文简报沉淀到这里</h2>
            <p className="mt-1.5 text-sm leading-6 text-white/60">
              订阅 RSS 源 → 一键生成本日简报 → 好内容转成笔记。已订阅 {stats?.rss_sources ?? 0} 个源 · {stats?.rss_items ?? 0} 条资讯。
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={genBriefing} disabled={briefing}
              className="btn-primary !bg-white !text-brand-700 shadow-lg hover:!bg-white/90">
              {briefing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 生成今日简报
            </button>
            <div className="flex gap-2">
              <Link to="/briefings" className="btn-ghost !border-white/20 !bg-white/5 !text-white hover:!bg-white/10">简报归档</Link>
              <Link to="/news" className="btn-ghost !border-white/20 !bg-white/5 !text-white hover:!bg-white/10">管理资讯</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 贡献者 + 最新动态 ═══ */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 最新动态 */}
        <BentoCard className="p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold">最新动态</h2>
            <Link to="/resources" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">资源库 <ArrowUpRight size={13} /></Link>
          </div>
          <div className="divide-y divide-gray-50">
            {feedLoading && (
              <div className="space-y-3 p-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-12 shrink-0 animate-pulse rounded-full bg-gray-100" />
                    <div className="flex-1"><div className="mb-1.5 h-3.5 w-1/3 animate-pulse rounded bg-gray-100" /><div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" /></div>
                  </div>
                ))}
              </div>
            )}
            {!feedLoading && feed.length === 0 && (
              <EmptyState icon={Star} title="还没有动态" hint="上传资源、写笔记或生成简报后，动态会出现在这里" />
            )}
            {feed.map((f) => {
              const meta = KIND_META[f.kind] ?? KIND_META.announcement
              const expandable = f.kind === 'ai' || f.kind === 'announcement'
              const href = f.kind === 'resource' ? `/resources/${f.id}` : f.kind === 'note' ? '/memos' : f.source_url || undefined
              const body = (
                <div onClick={expandable ? () => setViewing(f) : undefined}
                  className={`flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 ${expandable ? 'cursor-pointer' : ''}`}>
                  <span className={`chip mt-0.5 shrink-0 ${meta.cls}`}>{meta.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{f.title}</p>
                    <p className="truncate text-xs text-subtle">{f.summary}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{f.created_by} · <span title={f.created_at}>{timeAgo(f.created_at)}</span></p>
                  </div>
                </div>
              )
              if (expandable) return <div key={`${f.kind}-${f.id}`}>{body}</div>
              return href ? <Link key={`${f.kind}-${f.id}`} to={href} className="block">{body}</Link> : <div key={`${f.kind}-${f.id}`}>{body}</div>
            })}
          </div>
        </BentoCard>

        {/* 贡献者榜 */}
        <BentoCard className="p-5">
          <h2 className="mb-4 flex items-center gap-1.5 text-sm font-bold"><Trophy size={15} className="text-amber-500" /> 贡献者榜</h2>
          <div className="space-y-3">
            {contributors.length === 0 && <p className="text-xs text-gray-400">还没有贡献记录</p>}
            {contributors.slice(0, 6).map((c, i) => (
              <button key={c.user} onClick={() => (location.href = `/resources?user=${encodeURIComponent(c.user)}`)} className="flex w-full items-center gap-2.5 text-left">
                <span className={`w-4 shrink-0 text-center text-xs font-bold tabular-nums ${i < 3 ? 'text-brand-600' : 'text-gray-400'}`}>{i + 1}</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">{c.user.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand-600">{c.user}</span>
                <span className="shrink-0 text-xs text-subtle">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4">
            <button onClick={() => askAssistant('我想上传一个自己写的技能/工具，帮我梳理要点')} className="btn-ghost w-full text-xs">
              <Bot size={14} /> 让 AI 帮我整理要上传的内容
            </button>
            <Link to="/resources" className="btn-primary w-full text-xs"><Package size={14} /> 上传资源</Link>
          </div>
        </BentoCard>
      </section>

      {/* ═══ 内容卡全文弹窗 ═══ */}
      {viewing && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="max-h-[82vh] w-full max-w-xl overflow-y-auto glass-modal lg-edge rounded-bento2 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className={`chip ${KIND_META[viewing.kind]?.cls ?? KIND_META.announcement.cls}`}>{KIND_META[viewing.kind]?.label}</span>
                <h2 className="mt-2 text-lg font-bold tracking-tight">{viewing.title}</h2>
                <p className="text-xs text-gray-400">{viewing.created_by} · {viewing.created_at}</p>
              </div>
              <div className="flex items-center gap-1">
                {(viewing.kind === 'ai' || viewing.kind === 'announcement') && (
                  <button title="删除这张内容卡" className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50"
                    onClick={async () => {
                      try {
                        await api.delete(`/hub/cards/${viewing.id}`)
                        setFeed((l) => l.filter((x) => !(x.kind === viewing.kind && x.id === viewing.id)))
                        setViewing(null)
                        toast('success', '内容卡已删除')
                      } catch (e) { toast('error', (e as Error).message) }
                    }}>
                    <Trash2 size={15} />
                  </button>
                )}
                <button className="rounded-lg p-1.5 text-subtle hover:bg-gray-100" onClick={() => setViewing(null)}>✕</button>
              </div>
            </div>
            {viewing.source_url && (
              <a href={viewing.source_url} target="_blank" rel="noreferrer" className="mb-3 block truncate text-xs text-brand-600 hover:underline">{viewing.source_url}</a>
            )}
            <MarkdownView text={viewing.content || viewing.summary} />
          </div>
        </div>
      )}
    </div>
  )
}
