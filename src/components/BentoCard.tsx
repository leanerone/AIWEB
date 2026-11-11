import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLiquidGlass, type GlassOptics } from '../hooks/useLiquidGlass'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  onClick?: () => void
  id?: string
  /** 开启真折射（SDF + Snell 边缘弯折 + 镜面高光）。默认关闭走磨砂，避免整页几十张卡各建滤镜 */
  glass?: boolean
  /** 折射剖面用的圆角，需与实际 border-radius 一致（.card-lg 默认 16px） */
  glassRadius?: number
  /** 光学参数覆盖；不同参数会各建一个滤镜，仅给少量重点表面用 */
  optics?: GlassOptics
}

/** 基础卡片：液态玻璃（.card-lg 半透磨砂 + .lg-edge 边缘高光），轻微入场淡入 */
export function BentoCard({ children, className = '', delay = 0, onClick, id, glass = false, glassRadius = 16, optics }: Props) {
  const glassRef = useLiquidGlass<HTMLDivElement>({ radius: glassRadius, level: 'elevated', enabled: glass, optics })
  return (
    <motion.div
      id={id}
      ref={glassRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={`lg-edge card-lg transition-shadow hover:shadow-bentoHover ${className}`}
    >
      {children}
    </motion.div>
  )
}
