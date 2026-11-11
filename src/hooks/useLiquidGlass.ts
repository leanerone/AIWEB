import { useEffect, useRef } from 'react'
import { acquireFilter } from '../vendor/liquidglass/core/filter-registry.js'
import {
  isBackdropFilterSupported,
  isGlassRefractionSupported,
} from '../vendor/liquidglass/capabilities.js'

/**
 * 液态玻璃接入钩子（引擎来自 src/vendor/liquidglass，MIT / Wei-Zhang09/LiquidGlassUI）。
 *
 * 为什么是钩子而不是直接用上游的 <lg-glass-surface>：本项目已有 BentoCard / 浮层组件体系，
 * 换自定义元素会引入 shadow DOM 与既有 Tailwind 样式的冲突。这里只借用引擎的两件事：
 *   1) 能力门控（isGlassRefractionSupported 用 UA 嗅探——CSS.supports 对 backdrop-filter:url()
 *      在 Firefox/Safari 会谎报 true 但静默不渲染）
 *   2) 折射滤镜的生成与按几何缓存（acquireFilter）
 *
 * 降级阶梯与上游 glass-base 一致：refraction → frost → solid；
 * 元素尺寸为 0 时不降档（尚未布局，等 ResizeObserver 再试），过小（<4px）才降 frost，
 * 否则会留下一块"声称支持折射、实际什么都没画"的玻璃。
 */
export type GlassLevel = 'plain' | 'regular' | 'elevated' | 'focused'

/** 与上游 LEVEL_BLUR / tokens.blur 保持一致（plain/regular/elevated/focused） */
const LEVEL_BLUR_PX: Record<GlassLevel, number> = { plain: 0, regular: 2, elevated: 6, focused: 14 }
const MIN_FILTER_SIZE = 4

interface Options {
  /** 圆角 px，需与元素实际 border-radius 一致，否则折射剖面对不上 */
  radius?: number
  level?: GlassLevel
  /** 边缘剖面形状，上游默认 convexSquircle */
  surface?: string
  enabled?: boolean
}

export function useLiquidGlass<T extends HTMLElement>(opts: Options = {}) {
  const { radius = 26, level = 'elevated', surface = 'convexSquircle', enabled = true } = opts
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const support = isGlassRefractionSupported()
      ? 'refraction'
      : isBackdropFilterSupported()
        ? 'frost'
        : 'solid'
    el.dataset.lgSupport = support
    if (support !== 'refraction') return

    let frame = 0
    let filterId: string | null = null

    const build = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.ceil(rect.width)
      const h = Math.ceil(rect.height)
      if (w <= 0 || h <= 0) return                       // 还没布局，别急着降档
      if (w < MIN_FILTER_SIZE || h < MIN_FILTER_SIZE) {
        el.dataset.lgSupport = 'frost'
        return
      }
      const id = acquireFilter({
        width: w,
        height: h,
        radius: Math.min(radius, Math.min(w, h) / 2),
        surface,
        blur: LEVEL_BLUR_PX[level],
      })
      if (!id) {                                         // 几何不足以构成边缘带
        el.dataset.lgSupport = 'frost'
        return
      }
      if (id === filterId) return
      filterId = id
      el.style.setProperty('--lg-filter', `url(#${id})`)
    }

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(build)
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    schedule()
    return () => {
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [radius, level, surface, enabled])

  return ref
}
