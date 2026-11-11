import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BentoCard } from './BentoCard'

interface Props {
  icon: LucideIcon
  label: string
  value: number
  to?: string
  delay?: number
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky'
}

const TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
}

/** 统计卡：数字 count-up 滚动 */
export function StatCard({ icon: Icon, label, value, to, delay = 0, tone = 'brand' }: Props) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v).toString())

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, delay, ease: 'easeOut' })
    return controls.stop
  }, [value, delay, mv])

  const inner = (
    <div className="flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>
        <Icon size={22} />
      </span>
      <div>
        <motion.span className="block text-2xl font-bold tabular-nums tracking-tight">{rounded}</motion.span>
        <span className="text-xs text-subtle">{label}</span>
      </div>
    </div>
  )

  // 统计卡只有 4 张且几何相同 → 开真折射，滤镜按几何缓存复用，首屏即可见玻璃质感
  if (to) {
    return (
      <BentoCard glass delay={delay} onClick={() => (location.href = to)} className="cursor-pointer">
        {inner}
      </BentoCard>
    )
  }
  return <BentoCard glass delay={delay}>{inner}</BentoCard>
}
