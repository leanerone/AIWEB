import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  onClick?: () => void
  id?: string
}

/** Bento 基础卡片：入场淡入上浮 + hover 微抬升 */
export function BentoCard({ children, className = '', delay = 0, onClick, id }: Props) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`rounded-bento border border-gray-100 bg-white shadow-bento transition-shadow hover:shadow-bentoHover ${className}`}
    >
      {children}
    </motion.div>
  )
}
