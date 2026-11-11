import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  onClick?: () => void
  id?: string
}

/** 基础卡片：液态玻璃（.card-lg 半透磨砂 + .lg-edge 边缘高光），轻微入场淡入 */
export function BentoCard({ children, className = '', delay = 0, onClick, id }: Props) {
  return (
    <motion.div
      id={id}
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
