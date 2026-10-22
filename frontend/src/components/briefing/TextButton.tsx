import type { ButtonHTMLAttributes } from 'react'
import { PlusIcon } from '../icons'

/** The briefing page's one quiet control: ink text and a trailing plus that becomes a minus when open. */
export function TextButton({ open, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean }) {
  return (
    <button type="button" {...rest} className={className ? `text-btn ${className}` : 'text-btn'}>
      {children}<PlusIcon size={10} className="text-btn-glyph" open={open} />
    </button>
  )
}
