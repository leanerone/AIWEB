import { ArrowLeft, Download, ExternalLink, Heart, History, Loader2, MessageSquare, Pencil, Send, Share2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { BentoCard } from '../components/BentoCard'
import { BookmarkButton } from '../components/BookmarkButton'
import { MarkdownView } from '../components/MarkdownView'
import { NotesLinkCard } from '../components/NotesLinkCard'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import type { Resource } from '../types'

interface CommentItem { id: number; content: string; created_by: string; created_at: string }
interface VersionItem { id: number; name: string; summary: string; tags: string[]; file_name: string | null; updated_by: string; created_at: string }

const TYPE_LABEL: Record<string, string> = { skill: 'Skill', tool: '工具', plugin: '插件' }
const TYPE_BADGE: Record<string, string> = {
  skill: 'bg-brand-100 text-brand-700',
  tool: 'bg-emerald-100 text-emerald-700',
  plugin: 'bg-amber-100 text-amber-700',
}

export function ResourceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useAuth((s) => s.user)
  const toast = useToast()
  const [r, setR] = useState<Resource | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [restoring, setRestoring] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editBusy, setEditBusy] = useState(false)
  const [edit, setEdit] = useState({ type: 'skill', name: '', summary: '', content: '', tags: '', external_url: '' })

  const loadComments = (id: number) => {
    api.get<never, CommentItem[]>(`/resources/${id}/comments`).then(setComments).catch(() => {})
    api.get<never, VersionItem[]>(`/resources/${id}/versions`).then(setVersions).catch(() => {})
  }

  useEffect(() => {
    api.get<never, Resource>(`/resources/${id}`).then((d) => {
      setR(d)
      loadComments(d.id)
    }).catch((e) => toast('error', (e as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const submitComment = async () => {
    const content = newComment.trim()
    if (!content || !r) return
    setSending(true)
    try {
      const c = await api.post<never, CommentItem>(`/resources/${r.id}/comments`, { content })
      setComments((list) => [...list, c])
      setNewComment('')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const download = () => {
    const token = localStorage.getItem('aiweb_token')
    fetch(`/api/resources/${id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (resp) => {
        if (!resp.ok) throw new Error('下载失败')
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = r?.file_name || 'download'
        a.click()
        URL.revokeObjectURL(url)
        setR((p) => (p ? { ...p, downloads: p.downloads + 1 } : p))
      })
      .catch((e) => toast('error', e.message))
  }

  const del = async () => {
    try {
      await api.delete(`/resources/${id}`)
      toast('success', '已删除')
      nav('/resources')
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  if (!r) {
    return (
      <div className="space-y-4" data-testid="detail-skeleton">
        <div className="h-5 w-28 animate-pulse rounded-lg bg-gray-200/70" />
        <div className="rounded-bento border border-gray-100 bg-white p-6 shadow-bento">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200/70" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200/70" />
          </div>
          <div className="mt-3 h-7 w-2/3 animate-pulse rounded-lg bg-gray-200/70" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 h-3 w-40 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="rounded-bento border border-gray-100 bg-white p-6 shadow-bento">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-3 h-4 animate-pulse rounded bg-gray-100" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/resources" className="inline-flex items-center gap-1 text-sm text-subtle hover:text-brand-600">
        <ArrowLeft size={15} /> 返回资源库
      </Link>

      <BentoCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`chip ${TYPE_BADGE[r.type]}`}>{TYPE_LABEL[r.type]}</span>
              {r.tags.map((t) => <span key={t} className="chip bg-gray-100 text-gray-600">#{t}</span>)}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{r.name}</h1>
            <p className="mt-1 text-sm text-subtle">{r.summary}</p>
            <p className="mt-2 text-xs text-gray-400">
              {r.author || r.created_by} · {r.created_at} · {r.views} 浏览 · {r.downloads} 下载
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={r.liked_by_me ? 'btn bg-rose-50 text-rose-500 border border-rose-100' : 'btn-ghost'}
              onClick={async () => {
                try {
                  const d = await api.post<never, { likes: number; liked_by_me: boolean }>(`/resources/${r.id}/like`)
                  setR({ ...r, likes: d.likes, liked_by_me: d.liked_by_me })
                } catch (e) { toast('error', (e as Error).message) }
              }}
            >
              <Heart size={15} fill={r.liked_by_me ? 'currentColor' : 'none'} /> {r.likes}
            </button>
            {r.source_type === 'upload' && (
              <button className="btn-primary" onClick={download}><Download size={15} /> 下载附件</button>
            )}
            {r.external_url && (
              <a className="btn-ghost" href={r.external_url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> 打开外链
              </a>
            )}
            <BookmarkButton targetType="resource" targetId={r.id}
              bookmarked={!!r.bookmarked_by_me}
              onToggle={(b) => setR({ ...r, bookmarked_by_me: b })} withText />
            <button className="btn-ghost" title="复制本页内网链接"
              onClick={async () => {
                await navigator.clipboard.writeText(location.href)
                toast('success', '链接已复制，可发给同事')
              }}>
              <Share2 size={15} /> 分享
            </button>
            {(me?.role === 'admin' || me?.username === r.created_by) && (
              <>
                <button className="btn-ghost" onClick={() => {
                  setEdit({ type: r.type, name: r.name, summary: r.summary, content: r.content,
                    tags: r.tags.join(','), external_url: r.external_url || '' })
                  setEditOpen(true)
                }}><Pencil size={15} /> 编辑</button>
                <button className="btn-danger" onClick={() => setConfirmDel(true)}><Trash2 size={15} /> 删除</button>
              </>
            )}
          </div>
        </div>
      </BentoCard>

      {r.content && (
        <BentoCard className="p-6" delay={0.08}>
          <h2 className="mb-3 text-sm font-bold">详细介绍</h2>
          <MarkdownView text={r.content} />
        </BentoCard>
      )}

      {(me?.role === 'admin' || me?.username === r.created_by) && versions.length > 0 && (
        <BentoCard className="p-5" delay={0.14}>
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold">
            <History size={15} className="text-violet-500" /> 历史版本 <span className="text-xs text-gray-400">({versions.length})</span>
          </h2>
          <p className="mb-3 text-xs text-subtle">每次更新前的自动快照，可一键回滚；回滚前当前内容也会被快照</p>
          <div className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="truncate text-[11px] text-gray-400">{v.summary || '（无简介）'}</p>
                  <p className="text-[11px] text-gray-400">{v.updated_by} · {v.created_at}</p>
                </div>
                <button className="btn-ghost shrink-0 !px-2.5 !py-1 text-xs" disabled={restoring}
                  onClick={async () => {
                    if (!window.confirm(`回滚到 ${v.created_at} 的版本？当前内容会先被快照。`)) return
                    setRestoring(true)
                    try {
                      await api.post(`/resources/${r.id}/restore/${v.id}`)
                      toast('success', '已回滚，页面即将刷新')
                      window.setTimeout(() => window.location.reload(), 600)
                    } catch (e) { toast('error', (e as Error).message) } finally { setRestoring(false) }
                  }}>回滚</button>
              </div>
            ))}
          </div>
        </BentoCard>
      )}

      <BentoCard className="p-5" delay={0.12}>
        <h2 className="mb-3 text-sm font-bold">关联 Notes 链接</h2>
        <p className="mb-3 text-xs text-subtle">该资源相关的 Notes 工作记录，粘贴链接自动解析，点击即可唤起 Notes 客户端</p>
        <NotesLinkCard onSaved={() => toast('success', '链接已入库')} />
      </BentoCard>

      <BentoCard className="p-5" delay={0.16}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <MessageSquare size={15} className="text-brand-500" /> 讨论 <span className="text-xs text-gray-400">({comments.length})</span>
        </h2>
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="group flex items-start gap-2.5 rounded-xl bg-gray-50 px-3.5 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                {(c.created_by || 'U').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-subtle">
                  <b className="text-ink">{c.created_by}</b> · {c.created_at}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{c.content}</p>
              </div>
              <button className="hidden shrink-0 rounded-lg p-1 text-red-400 hover:bg-red-50 group-hover:block"
                onClick={async () => {
                  try {
                    await api.delete(`/resources/comments/${c.id}`)
                    setComments((list) => list.filter((x) => x.id !== c.id))
                  } catch (e) { toast('error', (e as Error).message) }
                }}><Trash2 size={13} /></button>
            </div>
          ))}
          {comments.length === 0 && <p className="pb-1 text-xs text-gray-400">还没有讨论，说说你的使用心得或问题吧</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input flex-1" placeholder="写下你的评论，回车发送…" value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitComment()} />
          <button className="btn-primary shrink-0" onClick={submitComment} disabled={sending || !newComment.trim()}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </BentoCard>

      {/* 编辑弹窗 */}
      {editOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={() => setEditOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-bento2 bg-white p-6 shadow-bentoHover"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">编辑资源</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select className="input cursor-pointer" value={edit.type}
                  onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                  <option value="skill">Skill</option>
                  <option value="tool">小工具</option>
                  <option value="plugin">插件</option>
                </select>
                <input className="input" placeholder="名称" value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <input className="input" placeholder="一句话简介" value={edit.summary}
                onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
              <textarea className="input min-h-[130px]" placeholder="详细介绍（Markdown）" value={edit.content}
                onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
              <input className="input" placeholder="标签，逗号分隔" value={edit.tags}
                onChange={(e) => setEdit({ ...edit, tags: e.target.value })} />
              <input className="input" placeholder="外链地址" value={edit.external_url}
                onChange={(e) => setEdit({ ...edit, external_url: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>取消</button>
              <button className="btn-primary" disabled={editBusy}
                onClick={async () => {
                  setEditBusy(true)
                  try {
                    const d = await api.put<never, Resource>(`/resources/${r!.id}`, {
                      type: edit.type, name: edit.name, summary: edit.summary, content: edit.content,
                      tags: edit.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
                      author: r!.author, source_type: r!.source_type, external_url: edit.external_url || null,
                    })
                    setR({ ...r!, ...d })
                    setEditOpen(false)
                    toast('success', '已保存')
                  } catch (e) {
                    toast('error', (e as Error).message)
                  } finally {
                    setEditBusy(false)
                  }
                }}>
                {editBusy && <Loader2 size={15} className="animate-spin" />} 保存
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel} danger
        title="删除资源"
        message={`确定删除「${r.name}」吗？附件也会一并删除，不可恢复。`}
        onConfirm={() => { setConfirmDel(false); del() }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}
