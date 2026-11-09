import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

/**
 * 变形下拉导航。移植自 docs/design/halden-hero-morphing-nav-spec.txt，
 * 逻辑与 aihub-preview/index.html（浏览器实测 1:1 通过）保持同一实现方式：
 * 在 useEffect 里用 refs 直接操作 DOM（classList / CSS 自定义属性），
 * 不用 React state 驱动动画时序——首开 .instant 需要「先无过渡定位、下一帧再解除」，
 * 命令式更可靠。
 *
 * 面板尺寸沿用规格值：资源库 664×358 / AI 能力 446×308 / 平台 232×218
 */

const RES_ITEMS = [
  { to: '/resources?type=skill', title: 'Skills 技能包', desc: 'SKILL.md 规范技能，上传自动提取元数据', img: '/hero/p-skills-code.jpg' },
  { to: '/resources?type=tool', title: '小工具', desc: '脚本与小程序，覆盖排障、报表、批处理', img: '/hero/p-tools-desk.jpg' },
  { to: '/resources?type=plugin', title: '插件', desc: 'IDE 与平台扩展，团队内一键分发', img: '/hero/p-plugin-robot.jpg' },
  { to: '/memos', title: 'Notes 链接库', desc: 'notes:// 解析归档，一键唤起本机客户端', img: '/hero/p-notes-library.jpg' },
]
const AI_CARDS = [
  { to: '/chat', title: 'AI 对话', desc: 'SSE 流式问答，可引用资源上下文', img: '/hero/c-ai-network.jpg' },
  { to: '/', title: '每日简报', desc: '资讯聚合自动生成，沉淀到首页动态', img: '/hero/c-briefing-fans.jpg' },
]
const PLAT_ITEMS = [
  { to: '/', title: '首页动态' },
  { to: '/resources', title: '我的收藏' },
  { to: '/resources', title: '贡献者榜' },
  { to: '/', title: '通知中心' },
]

export function MegaMenu() {
  const nav = useNavigate()
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const navEl = rootRef.current
    if (!navEl) return
    const header = navEl.closest('header') || navEl
    const dd = navEl.querySelector<HTMLElement>('.mega-dd')!
    const triggers = Array.from(navEl.querySelectorAll<HTMLButtonElement>('[data-menu]'))
    const panels: Record<string, HTMLElement> = {}
    triggers.forEach((t) => { panels[t.dataset.menu!] = navEl.querySelector<HTMLElement>(`#p-${t.dataset.menu}`)! })
    const menus = ['resources', 'ai', 'platform']
    const PAD = 20
    let current: string | null = null
    let closeTimer = 0

    const place = (id: string) => {
      const panel = panels[id]
      const w = panel.offsetWidth
      const trig = triggers.find((t) => t.dataset.menu === id)!.getBoundingClientRect()
      const host = header.getBoundingClientRect()
      let x = trig.left - PAD
      x = Math.min(Math.max(x, host.left + 12), host.right - w - 12)
      x -= (dd.offsetParent || header).getBoundingClientRect().left
      dd.style.setProperty('--x', `${x}px`)
      dd.style.setProperty('--w', `${w}px`)
      dd.style.setProperty('--h', `${panel.offsetHeight}px`)
    }

    const open = (id: string) => {
      window.clearTimeout(closeTimer)
      if (current === id) return
      if (current === null) {
        dd.classList.add('is-instant', 'is-noanim')
        Object.values(panels).forEach((p) => { p.classList.add('is-noanim'); p.removeAttribute('data-state') })
        place(id)
        void dd.offsetWidth
        dd.classList.remove('is-noanim')
        Object.values(panels).forEach((p) => p.classList.remove('is-noanim'))
        dd.classList.add('is-open')
        // 下一帧解除 is-instant；后台面板会冻结 rAF，故双保险 setTimeout
        requestAnimationFrame(() => dd.classList.remove('is-instant'))
        window.setTimeout(() => dd.classList.remove('is-instant'), 60)
      } else {
        const dir = menus.indexOf(id) > menus.indexOf(current) ? 1 : -1
        panels[current].setAttribute('data-state', dir > 0 ? 'exit-left' : 'exit-right')
        const p = panels[id]
        p.classList.add('is-noanim')
        p.setAttribute('data-state', dir > 0 ? 'exit-right' : 'exit-left')
        void dd.offsetWidth
        p.classList.remove('is-noanim')
        place(id)
      }
      panels[id].setAttribute('data-state', 'active')
      triggers.forEach((t) => t.setAttribute('aria-expanded', String(t.dataset.menu === id)))
      current = id
    }

    const close = () => {
      dd.classList.remove('is-open')
      if (current) panels[current].removeAttribute('data-state')
      triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'))
      current = null
    }
    const scheduleClose = (ms = 140) => {
      window.clearTimeout(closeTimer)
      closeTimer = window.setTimeout(close, ms)
    }

    const cleanups: Array<() => void> = []
    const on = <T extends EventTarget>(el: T, type: string, fn: (e: any) => void, opts?: any) => {
      el.addEventListener(type, fn, opts)
      cleanups.push(() => el.removeEventListener(type, fn, opts))
    }

    triggers.forEach((t) => {
      const menu = t.dataset.menu!
      on(t, 'pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') open(menu) })
      on(t, 'click', () => (current === menu ? close() : open(menu)))
    })
    on(navEl, 'pointerenter', () => window.clearTimeout(closeTimer))
    on(navEl, 'pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse') scheduleClose() })
    on(navEl, 'focusout', (e: FocusEvent) => { if (!navEl.contains(e.relatedTarget as Node)) scheduleClose(0) })
    on(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const trig = current ? triggers.find((t) => t.dataset.menu === current) : null
      close()
      trig?.focus()
    })
    on(document, 'pointerdown', (e: PointerEvent) => {
      const el = dd.closest('nav')
      if (el && !el.contains(e.target as Node)) close()
    })
    on(window, 'resize', () => { if (current) place(current) })

    // 资源库行 ↔ 预览图交叉淡入
    const rows = Array.from(navEl.querySelectorAll<HTMLElement>('.mega-row'))
    const imgs = Array.from(navEl.querySelectorAll<HTMLElement>('.mega-media img'))
    const activate = (n: number) => {
      rows.forEach((el, i) => el.classList.toggle('is-active', i === n))
      imgs.forEach((el, i) => el.classList.toggle('is-active', i === n))
    }
    rows.forEach((el) => {
      const n = Number(el.dataset.img)
      on(el, 'pointerenter', () => activate(n))
      on(el, 'focus', () => activate(n))
    })

    // SPA 导航（拦截面板内所有链接点击）
    const onClickNav = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-spa]')
      if (!a) return
      e.preventDefault()
      close()
      nav(a.getAttribute('href')!)
    }
    on(navEl, 'click', onClickNav)

    cleanups.push(() => window.clearTimeout(closeTimer))
    return () => cleanups.forEach((fn) => fn())
  }, [nav])

  return (
    <nav ref={rootRef} className="mega-nav" aria-label="主导航">
      <div className="flex items-center gap-6">
        {([['resources', '资源库'], ['ai', 'AI 能力'], ['platform', '平台']] as const).map(([id, label]) => (
          <button key={id} data-menu={id} className="mega-trigger" aria-expanded="false">
            {label}
            <ChevronDown size={12} className="mega-chev" />
          </button>
        ))}
        <a href="/settings" data-spa className="mega-trigger">设置</a>
      </div>

      <div className="mega-dd" id="mega-dd">
        {/* 资源库 664×358 */}
        <div className="mega-panel panel-resources" id="p-resources">
          <div className="flex flex-col gap-0.5 p-2">
            {RES_ITEMS.map((it, i) => (
              <a key={it.title} href={it.to} data-spa className={`mega-row${i === 0 ? ' is-active' : ''}`} data-img={i}>
                <strong>{it.title}</strong>
                <span>{it.desc}</span>
              </a>
            ))}
          </div>
          <div className="mega-media" aria-hidden="true">
            {RES_ITEMS.map((it, i) => (
              <img key={it.img} src={it.img} alt="" className={i === 0 ? 'is-active' : ''} loading="lazy" />
            ))}
          </div>
        </div>

        {/* AI 能力 446×308 */}
        <div className="mega-panel panel-ai" id="p-ai">
          {AI_CARDS.map((c) => (
            <a key={c.title} href={c.to} data-spa className="mega-card">
              <img src={c.img} alt="" loading="lazy" />
              <strong>{c.title}</strong>
              <span>{c.desc}</span>
            </a>
          ))}
        </div>

        {/* 平台 232×218 */}
        <div className="mega-panel panel-platform" id="p-platform">
          {PLAT_ITEMS.map((p) => (
            <a key={p.title} href={p.to} data-spa className="mega-rlink">{p.title}</a>
          ))}
        </div>
      </div>
    </nav>
  )
}
