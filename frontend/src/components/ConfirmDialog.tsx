import { useEffect, useRef } from 'react'
import './confirm.css'

/** In-page confirmation on a native <dialog>: never window.confirm, which blocks the page. */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2 id="confirm-title" className="confirm-title">{title}</h2>
      <p className="confirm-body">{body}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel} data-cursor="link">Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} data-cursor="link">{confirmLabel}</button>
      </div>
    </dialog>
  )
}
