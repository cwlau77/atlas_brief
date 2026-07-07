import { AnimatePresence, motion } from 'framer-motion'
import './toast.css'

export interface ToastItem {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

export function ToastHost({ toasts, onDismiss }: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="toast-host" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.tone}`}
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
