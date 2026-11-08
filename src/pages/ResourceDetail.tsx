import { ArrowLeft, Download, ExternalLink, Heart, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../stores/auth'
import { BentoCard } from '../components/BentoCard'
import { MarkdownView } from '../components/MarkdownView'
import { NotesLinkCard } from '../components/NotesLinkCard'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import type { Resource } from '../types'

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

  useEffect(() => {
    api.get<never, Resource>(`/resources/${id}`).then(setR).catch((e) => toast('error', (e as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand-400" size={28} /></div>
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
            {(me?.role === 'admin' || me?.username === r.created_by) && (
              <button className="btn-danger" onClick={() => setConfirmDel(true)}><Trash2 size={15} /> 删除</button>
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

      <BentoCard className="p-5" delay={0.12}>
        <h2 className="mb-3 text-sm font-bold">关联 Notes 链接</h2>
        <p className="mb-3 text-xs text-subtle">该资源相关的 Notes 工作记录，粘贴链接自动解析，点击即可唤起 Notes 客户端</p>
        <NotesLinkCard onSaved={() => toast('success', '链接已入库')} />
      </BentoCard>

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
