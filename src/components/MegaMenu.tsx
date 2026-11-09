import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

/**
 * 顶栏导航 = 普通路由项（首页/笔记/设置，与页面同风格、当前页高亮）
 *          + 两个变形下拉面板（资源库 / AI 能力）。
 *
 * 变形逻辑移植自 docs/design/halden-hero-morphing-nav-spec.txt（vanilla 版在 aihub-preview 实测 1:1）：
 * 首次打开先无过渡定位再解除（is-instant），切换时容器 x/宽/高 0.5s 形变，
 * 面板按行进方向 ±56px 滑入 + blur 交叉淡入；140ms 关闭宽限；Esc 回焦；resize 重定位。
 * 命令式操作 DOM（refs + classList + CSS 变量），React state 驱动动画时序会卡帧。
 *
 * 面板配色跟随明暗主题（浅色模式=白玻璃，深色模式=暗玻璃），避免与页面割裂。
 */

const RES_ITEMS = [
  { to: '/resources?type=skill', title: 'Skills 技能包', desc: 'SKILL.md 规范技能，上传自动提取元数据', img: '/hero/p-skills-code.jpg' },
  { to: '/resources?type=tool', title: '小工具', desc: '脚本与小程序，覆盖排障、报表、批处理', img: '/hero/p-tools-desk.jpg' },
  { to: '/resources?type=plugin', title: '插件', desc: 'IDE 与平台扩展，团队内一键分发', img: '/hero/p-plugin-robot.jpg' },
  { to: '/memos#links', title: 'Notes 链接库', desc: 'notes:// 解析归档，一键唤起本机客户端', img: '/hero/p-notes-library.jpg' },
]
const AI_CARDS = [
  { to: '/chat', title: 'AI 对话', desc: 'SSE 流式问答，可引用资源上下文', img: '/hero/c-ai-network.jpg' },
  // 每日简报不是一个页面：订阅源在设置页管理，生成按钮在首页。这里带锚点直达设置页的订阅区块
  { to: '/settings#rss', title: '资讯订阅', desc: 'RSS 源管理与简报设置', img: '/hero/c-briefing-fans.jpg' },
]
const MENUS = ['resources', 'ai'] as const
type MenuId = typeof MENUS[number]

const MENU_PATH: Record<MenuId, string[]> = {
  resources: ['/resources'],
  ai: ['/chat'],
}

export function MegaMenu() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const rootRef = useRef<HTMLElement>(null)
  const closeRef = useRef<() => void>(() => {})
  const [current, setCurrent] = useState<MenuId | null>(null)

  const menuActive = (id: MenuId) => MENU_PATH[id].some((p) => pathname.startsWith(p))

  useEffect(() => {
    const navEl = rootRef.current
    if (!navEl) return
    const header = navEl.closest('header') || navEl
    const dd = navEl.querySelector<HTMLElement>('.mega-dd')!
    const triggers = Array.from(navEl.querySelectorAll<HTMLButtonElement>('[data-menu]'))
    const panels = {} as Record<MenuId, HTMLElement>
    MENUS.forEach((m) => { panels[m] = navEl.querySelector<HTMLElement>(`#p-${m}`)! })
    const PAD = 20
    let cur: MenuId | null = null
    let closeTimer = 0

    const place = (id: MenuId) => {
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

    const open = (id: MenuId) => {
      window.clearTimeout(closeTimer)
      if (cur === id) return
      if (cur === null) {
        dd.classList.add('is-instant', 'is-noanim')
        MENUS.forEach((m) => { panels[m].classList.add('is-noanim'); panels[m].removeAttribute('data-state') })
        place(id)
        void dd.offsetWidth
        dd.classList.remove('is-noanim')
        MENUS.forEach((m) => panels[m].classList.remove('is-noanim'))
        dd.classList.add('is-open')
        requestAnimationFrame(() => dd.classList.remove('is-instant'))
        window.setTimeout(() => dd.classList.remove('is-instant'), 60)
      } else {
        const dir = MENUS.indexOf(id) > MENUS.indexOf(cur) ? 1 : -1
        panels[cur].setAttribute('data-state', dir > 0 ? 'exit-left' : 'exit-right')
        const p = panels[id]
        p.classList.add('is-noanim')
        p.setAttribute('data-state', dir > 0 ? 'exit-right' : 'exit-left')
        void dd.offsetWidth
        p.classList.remove('is-noanim')
        place(id)
      }
      panels[id].setAttribute('data-state', 'active')
      triggers.forEach((t) => t.setAttribute('aria-expanded', String(t.dataset.menu === id)))
      cur = id
      setCurrent(id)
    }

    const close = () => {
      dd.classList.remove('is-open')
      if (cur) panels[cur].removeAttribute('data-state')
      triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'))
      cur = null
      setCurrent(null)
    }
    closeRef.current = close
    const scheduleClose = (ms = 140) => {
      window.clearTimeout(closeTimer)
      closeTimer = window.setTimeout(close, ms)
    }

    const cleanups: Array<() => void> = []
    const on = (el: EventTarget, type: string, fn: (e: any) => void) => {
      el.addEventListener(type, fn)
      cleanups.push(() => el.removeEventListener(type, fn))
    }

    triggers.forEach((t) => {
      const menu = t.dataset.menu as MenuId
      on(t, 'pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') open(menu) })
      on(t, 'click', () => (cur === menu ? close() : open(menu)))
    })
    on(navEl, 'pointerenter', () => window.clearTimeout(closeTimer))
    on(navEl, 'pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse') scheduleClose() })
    on(navEl, 'focusout', (e: FocusEvent) => { if (!navEl.contains(e.relatedTarget as Node)) scheduleClose(0) })
    on(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !cur) return
      const trig = triggers.find((t) => t.dataset.menu === cur)
      close()
      trig?.focus()
    })
    on(document, 'pointerdown', (e: PointerEvent) => { if (!navEl.contains(e.target as Node)) close() })
    on(window, 'resize', () => { if (cur) place(cur) })

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

    on(navEl, 'click', (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[data-spa]') as HTMLAnchorElement | null
      if (!a) return
      e.preventDefault()
      const [path, hash] = (a.getAttribute('href') || '').split('#')
      close()
      nav(path)
      if (hash) {
        // 等路由渲染完成后滚到锚点区块（scroll-mt-* 负责避开吸顶头部）
        window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180)
      }
    })
    cleanups.push(() => window.clearTimeout(closeTimer))
    return () => cleanups.forEach((fn) => fn())
  }, [nav])

  const plain = (to: string, label: string, end = false) => (
    <NavLink to={to} end={end} onClick={() => closeRef.current()}
      className={({ isActive }) =>
        `relative flex items-center rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
          isActive ? 'mega-link is-current text-brand-600' : 'mega-link text-subtle hover:bg-gray-50 hover:text-ink dark:hover:bg-white/5'}`
      }>
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-xl bg-brand-50 dark:bg-white/10"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
          )}
        </>
      )}
    </NavLink>
  )

  const trigger = (id: MenuId, label: string) => (
    <button data-menu={id}
      className={`mega-trigger ${current === id ? 'is-open' : ''} ${menuActive(id) ? 'is-current' : ''}`}
      aria-expanded={current === id}>
      {label}
      <ChevronDown size={12} className="mega-chev" />
    </button>
  )

  return (
    <nav ref={rootRef} className="mega-nav" aria-label="主导航">
      <div className="flex items-center gap-1.5">
        {plain('/', '首页', true)}
        {trigger('resources', '资源库')}
        {trigger('ai', 'AI 能力')}
        {plain('/memos', '笔记')}
        {plain('/settings', '设置')}
      </div>

      <div className="mega-dd">
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

        <div className="mega-panel panel-ai" id="p-ai">
          {AI_CARDS.map((c) => (
            <a key={c.title} href={c.to} data-spa className="mega-card">
              <img src={c.img} alt="" loading="lazy" />
              <strong>{c.title}</strong>
              <span>{c.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}
