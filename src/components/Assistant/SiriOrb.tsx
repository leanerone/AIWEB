import { motion } from 'framer-motion'

/**
 * Siri 风格 AI 光球：多层旋转极光 + 呼吸光晕 + 球面高光。
 * - idle：缓慢 swirl + 轻柔呼吸
 * - active（流式回答中）：swirl 加速、光晕增强、向外扩散涟漪
 * 仅用 transform/opacity 动画，GPU 友好；prefers-reduced-motion 下静止。
 */
export function SiriOrb({ active = false, size = 30 }: { active?: boolean; size?: number }) {
  return (
    <span
      className={`siri-orb${active ? ' is-active' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="siri-glow" />
      <span className="siri-spin siri-spin-a" />
      <span className="siri-spin siri-spin-b" />
      <span className="siri-sphere" />
      <span className="siri-sheen" />
      {active && (
        <>
          <motion.span
            className="siri-ring"
            initial={{ scale: 0.7, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            className="siri-ring"
            initial={{ scale: 0.7, opacity: 0.6 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
          />
        </>
      )}
    </span>
  )
}
