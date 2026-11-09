import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** 把 [[标题]] 渲染为笔记内链（点击去笔记页并按标题检索） */
function renderWikiLinks(text: string): string {
  return (text || '').replace(/\[\[([^\[\]|]{1,80})\]\]/g, (_m, title: string) =>
    `[${title}](/memos?keyword=${encodeURIComponent(title.trim())} "笔记：${title.trim()}")`)
}

export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}
        components={{
          // 内部链接走 SPA 路由，不整页刷新
          a: ({ href, children, title }) =>
            href?.startsWith('/') ? (
              <a href={href} title={title}
                onClick={(e) => {
                  e.preventDefault()
                  window.history.pushState({}, '', href)
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }}>{children}</a>
            ) : (
              <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>
            ),
        }}>
        {renderWikiLinks(text)}
      </ReactMarkdown>
    </div>
  )
}
