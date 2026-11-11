import { motion } from 'framer-motion'
import { Check, ClipboardPaste, Copy, Download, FileText, FileUp, Heart, Loader2, Lock, Package, Plus, Puzzle, Search, Sparkles, SquarePen, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent, MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { useList } from '../hooks/useList'
import { BentoCard } from '../components/BentoCard'
import { BookmarkButton } from '../components/BookmarkButton'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import type { Resource } from '../types'

/** 点赞按钮（乐观更新） */
export function LikeButton({ resource, onToggle }: { resource: Resource; onToggle?: (r: Resource) => void }) {
  const toast = useToast()
  const like = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const d = await api.post<never, { likes: number; liked_by_me: boolean }>(`/resources/${resource.id}/like`)
      onToggle?.({ ...resource, likes: d.likes, liked_by_me: d.liked_by_me })
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }
  return (
    <button onClick={like}
      className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] transition ${
        resource.liked_by_me ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'
      }`} title={resource.liked_by_me ? '取消点赞' : '点赞'}>
      <Heart size={13} fill={resource.liked_by_me ? 'currentColor' : 'none'} /> {resource.likes}
    </button>
  )
}

const TABS = [
  { key: '', label: '全部', icon: Package },
  { key: 'skill', label: 'Skills', icon: FileText },
  { key: 'tool', label: '小工具', icon: Wrench },
  { key: 'plugin', label: '插件', icon: Puzzle },
]

const TYPE_LABEL: Record<string, string> = { skill: 'Skill', tool: '工具', plugin: '插件' }
const TYPE_META: Record<string, { dot: string; chip: string }> = {
  skill: { dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700' },
  tool: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  plugin: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
}

/** SKILL.md 规范模板（对齐 agentskills.io 开放标准） */
export const SKILL_TEMPLATE = `---
name: my-skill
description: 一句话说明做什么、什么时候用（AI 靠它决定何时加载本技能）
license: MIT
version: 0.1.0
author: 你的名字
tags: [标签1, 标签2]
---

## 解决什么问题

一两句话说清楚使用场景。

## 使用步骤

1. 前置条件…
2. 操作步骤…
3. 验证方式…

## 注意事项

- 敏感数据先脱敏
- 常见坑…

## 让 AI 帮忙

把本技能交给悬浮助手时，附上：现象、环境、目标。`

/** 客户端 frontmatter 解析（与服务端 skill_meta 同规则，用于即时回填） */
export function parseFrontmatter(text: string): Record<string, string | string[]> {
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/)
  if (!m) return {}
  const out: Record<string, string | string[]> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim().toLowerCase()
    let val = line.slice(i + 1).trim()
    if (!key || !val) continue
    if (val.startsWith('[') && val.endsWith(']')) {
      out[key] = val.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    } else {
      out[key] = val.replace(/^['"]|['"]$/g, '')
    }
  }
  return out
}

/** 剥掉 frontmatter 后的正文 */
function stripFrontmatter(text: string): string {
  return text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '').trim()
}

export function Resources() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const userFilter = params.get('user') ?? ''
  const me = useAuth((s) => s.user)
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [order, setOrder] = useState('new')
  const [likedOnly, setLikedOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [likedMap, setLikedMap] = useState<Record<number, Pick<Resource, 'likes' | 'liked_by_me'>>>({})
  const [markedMap, setMarkedMap] = useState<Record<number, boolean>>({})
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const copyInstall = async (r: Resource) => {
    try {
      await navigator.clipboard.writeText(`请帮我从公司内网 AI Hub 安装/使用「${r.name}」，先告诉我它解决什么问题、怎么用。`)
      setCopiedId(r.id)
      toast('success', '安装指令已复制，粘贴给 AI 即可')
      window.setTimeout(() => setCopiedId((c) => (c === r.id ? null : c)), 1800)
    } catch { toast('error', '复制失败，请手动选取') }
  }

  const { keyword, setKeyword, items, loading, reload } = useList<Resource>(
    (p) => api.get<never, { total: number; items: Resource[] }>(
      `/resources?keyword=${encodeURIComponent(p.keyword)}&type=${type}&order=${order}&liked=${likedOnly ? 1 : 0}&tag=${encodeURIComponent(tagFilter)}&created_by=${encodeURIComponent(userFilter)}&page=${p.page}&limit=60`,
    ),
    [type, order, likedOnly, tagFilter, userFilter],
    60,
  )

  const applyLike = (r: Resource) => {
    setLikedMap((m) => ({ ...m, [r.id]: { likes: r.likes, liked_by_me: r.liked_by_me } }))
    if (likedOnly && !r.liked_by_me) reload()  // 「我的点赞」视图下取消点赞则移出列表
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight">资源库</h1>
        {tagFilter && (
          <button className="chip bg-brand-50 text-brand-700" onClick={() => setTagFilter('')}>
            标签：{tagFilter} ✕
          </button>
        )}
        {userFilter && (
          <button className="chip bg-violet-100 text-violet-700" onClick={() => setParams({})}>
            作者：{userFilter} ✕
          </button>
        )}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input w-60 pl-9" placeholder="搜索资源…" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className="input w-28 cursor-pointer" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="new">最新</option>
          <option value="likes">最多点赞</option>
          <option value="downloads">最多下载</option>
          <option value="views">最多浏览</option>
        </select>
        <button
          className={`btn ${likedOnly ? 'bg-rose-50 text-rose-500 border border-rose-200' : 'btn-ghost'}`}
          title="只看我点赞过的资源"
          onClick={() => setLikedOnly((v) => !v)}
        >
          <Heart size={15} fill={likedOnly ? 'currentColor' : 'none'} /> 我的点赞
        </button>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 上传资源
        </button>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams(t.key ? { type: t.key } : {})}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              type === t.key ? 'bg-brand-600 text-white shadow-bento' : 'bg-white text-subtle hover:text-ink border border-gray-100'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-400" size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="还没有资源"
          hint="把你的 SKILL.md 技能包、小脚本、插件传上来，让同事一起用"
          action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> 上传第一个</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r0, i) => {
            const r = { ...r0, ...(likedMap[r0.id] ?? {}), bookmarked_by_me: markedMap[r0.id] ?? r0.bookmarked_by_me }
            const meta = TYPE_META[r.type] ?? TYPE_META.skill
            return (
            <BentoCard key={r.id} delay={Math.min(i * 0.03, 0.2)} className="p-0">
              <div className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className={`chip ${meta.chip}`}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />{TYPE_LABEL[r.type] ?? '资源'}</span>
                  <span className="text-[11px] text-gray-400">{r.created_at}</span>
                </div>
                <Link to={`/resources/${r.id}`} className="mt-3 block">
                  <h3 className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink transition-colors hover:text-brand-600">
                    {r.visibility === 'private' && <Lock size={13} className="shrink-0 text-amber-500" />}
                    <span className="truncate">{r.name}</span>
                  </h3>
                </Link>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-subtle">
                  {r.summary || r.content.slice(0, 60) || '（无描述）'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.license && <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-700" title="开源许可">{r.license}</span>}
                  {r.tags.slice(0, 3).map((t) => (
                    <span key={t}
                      className={`chip cursor-pointer transition ${tagFilter === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700'}`}
                      onClick={() => setTagFilter(tagFilter === t ? '' : t)}>
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="min-w-0 flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="truncate">{r.created_by}</span>
                    <span className="flex shrink-0 items-center gap-1"><Download size={12} />{r.downloads}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button title="复制给 AI 的安装指令"
                      onClick={() => copyInstall(r)}
                      className="rounded-lg p-1.5 text-subtle transition hover:bg-brand-50 hover:text-brand-600">
                      {copiedId === r.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <BookmarkButton targetType="resource" targetId={r.id} size={14}
                      bookmarked={!!r.bookmarked_by_me}
                      onToggle={(b) => setMarkedMap((m) => ({ ...m, [r.id]: b }))} />
                    <LikeButton resource={r} onToggle={applyLike} />
                  </span>
                </div>
              </div>
            </BentoCard>
            )
          })}
        </div>
      )}

      {showForm && <CreateForm onClose={() => { setShowForm(false); reload() }} defaultAuthor={me?.display_name || me?.username || ''} />}
    </div>
  )
}

function CreateForm({ onClose, defaultAuthor }: { onClose: () => void; defaultAuthor: string }) {
  const toast = useToast()
  const [mode, setMode] = useState<'file' | 'paste' | 'template'>('file')
  const [type, setType] = useState('skill')
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [license, setLicense] = useState('MIT')
  const [version, setVersion] = useState('0.1.0')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /** 把（客户端或服务端）解析出的元数据回填表单 */
  const applyMeta = (meta: Record<string, unknown>, body?: string) => {
    if (meta.name) setName(String(meta.name))
    if (meta.description) setSummary(String(meta.description))
    if (body !== undefined) setContent(body)
    else if (meta.description && !content) setContent(String(meta.description))
    if (Array.isArray(meta.tags) && meta.tags.length) setTags(meta.tags.join(','))
    else if (typeof meta.tags === 'string' && meta.tags) setTags(meta.tags)
    if (meta.license) setLicense(String(meta.license))
    if (meta.version) setVersion(String(meta.version))
    if (meta.author && !defaultAuthor) setName((n) => n)  // author 由 defaultAuthor 兜底
  }

  /** .md 文件：客户端直接解析（无网络往返） */
  const readFile = async (f: File) => {
    const text = await f.text()
    const fm = parseFrontmatter(text)
    applyMeta(fm, stripFrontmatter(text))
    if (!name) setName(f.name.replace(/\.(md|markdown)$/i, ''))
    toast('success', '已解析 frontmatter 并回填表单')
  }

  /** .zip 等：走服务端 preview-meta 解析 */
  const previewOnServer = async (f: File) => {
    const fd = new FormData()
    fd.append('file', f)
    try {
      const d = await api.post<never, Record<string, unknown>>('/resources/preview-meta', fd)
      applyMeta(d, d.description ? String(d.description) : undefined)
      setFile(f)
      toast('success', '已解析压缩包元数据并回填表单')
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (/\.(md|markdown|txt)$/i.test(f.name)) {
      setFile(f)
      await readFile(f)
    } else {
      await previewOnServer(f)
    }
  }

  const onDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragOver(false)
    await handleFiles(e.dataTransfer.files)
  }

  const pasteParse = (text: string) => {
    const fm = parseFrontmatter(text)
    if (Object.keys(fm).length) {
      applyMeta(fm, stripFrontmatter(text))
      toast('success', '识别到 frontmatter，已回填表单')
    }
  }

  const useTemplate = () => {
    setMode('template')
    setContent(SKILL_TEMPLATE)
    pasteParse(SKILL_TEMPLATE)
  }

  const aiDescribe = async () => {
    if (!name.trim()) { toast('info', '先填写资源名称，AI 才能写简介'); return }
    setAiBusy(true)
    try {
      const d = await api.post<never, { summary: string }>('/ai/describe', { name, type, hints: content })
      setSummary(d.summary)
      toast('success', 'AI 简介已生成，可再手动修改')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  const submit = async () => {
    if (!name.trim()) { toast('info', '请填写资源名称'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('name', name)
      fd.append('summary', summary)
      fd.append('content', content)
      fd.append('tags', tags)
      fd.append('author', defaultAuthor)
      fd.append('license', license)
      fd.append('version', version)
      fd.append('visibility', visibility)
      fd.append('external_url', externalUrl)
      if (file) fd.append('file', file)
      await api.post('/resources', fd)
      toast('success', '资源已上架')
      onClose()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const MODES = [
    { key: 'file' as const, label: '上传文件', icon: FileUp, hint: '拖入 SKILL.md / zip，自动识别元数据' },
    { key: 'paste' as const, label: '粘贴创建', icon: ClipboardPaste, hint: '粘贴 Markdown（含 frontmatter 自动识别）' },
    { key: 'template' as const, label: '从模板开始', icon: SquarePen, hint: '载入 SKILL.md 规范模板再改' },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto glass-modal lg-edge rounded-bento2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold">上传资源</h2>
        {/* 三种创建方式 */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => (m.key === 'template' ? useTemplate() : setMode(m.key))}
              title={m.hint}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                (mode === m.key || (m.key === 'template' && mode === 'template'))
                  ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-subtle hover:border-brand-300'
              }`}>
              <m.icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {TABS.slice(1).map((t) => (
              <button key={t.key} onClick={() => setType(t.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  type === t.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-subtle hover:border-brand-300'
                }`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {/* 拖拽区（文件模式） */}
          {mode === 'file' && (
            <label
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
                dragOver ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-subtle hover:border-brand-400 hover:text-brand-600'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <FileUp size={20} />
              {file ? file.name : '把 SKILL.md / zip / 脚本拖到这里，或点击选择'}
              <span className="text-[11px] text-gray-400">.md 自动解析 frontmatter 并回填下方表单；zip 走服务端解析</span>
              <input ref={fileRef} type="file" className="hidden" accept=".md,.markdown,.txt,.zip"
                onChange={(e) => handleFiles(e.target.files)} />
            </label>
          )}

          {/* 粘贴区（粘贴模式） */}
          {mode === 'paste' && (
            <textarea className="input min-h-[140px] font-mono text-[12px]"
              placeholder={'粘贴 Markdown（支持 SKILL.md frontmatter，自动识别 name/description/tags/license…）'}
              onChange={(e) => pasteParse(e.target.value)} />
          )}

          <input className="input" placeholder="名称（Agent Skills 规范：小写字母/数字/连字符）" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="一句话简介（AI 靠它发现你的技能）" value={summary} onChange={(e) => setSummary(e.target.value)} />
            <button className="btn-ghost shrink-0" onClick={aiDescribe} disabled={aiBusy} title="AI 根据名称生成简介">
              {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI 简介
            </button>
          </div>
          <textarea className="input min-h-[100px]" placeholder="详细介绍（支持 Markdown）" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="标签，逗号分隔" value={tags} onChange={(e) => setTags(e.target.value)} />
            <input className="input" placeholder="许可（MIT…）" value={license} onChange={(e) => setLicense(e.target.value)} />
            <input className="input" placeholder="版本（0.1.0）" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([['public', '🌐 公开（全员可见）'], ['private', '🔒 私有（仅自己/管理员）']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setVisibility(k)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                  visibility === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-subtle hover:border-brand-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <input className="input" placeholder="外链地址（可选，如 Git 仓库 / 文档链接）" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          {mode === 'file' && file && /\.(zip|7z|gz|tar)$/i.test(file.name) && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] text-brand-700">已选压缩包：{file.name}（上架后同事可下载）</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" />} 上架
          </button>
        </div>
      </motion.div>
    </div>
  )
}
