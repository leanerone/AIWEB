import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  open: boolean
  title?: string
  message: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Promise 风格确认弹窗（杜绝原生 confirm） */
export function ConfirmDialog({ open, title = '确认操作', message, danger, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-sm rounded-bento2 bg-white p-6 shadow-bentoHover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-600'}`}>
                <AlertTriangle size={18} />
              </span>
              <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <p className="mb-5 text-sm leading-6 text-subtle">{message}</p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={onCancel}>取消</button>
              <button className={danger ? 'btn bg-red-500 text-white hover:bg-red-600' : 'btn-primary'} onClick={onConfirm}>
                确认
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
