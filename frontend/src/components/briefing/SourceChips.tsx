import { useState } from 'react'
import type { SourceCitation } from '../../lib/types'
import { relativeTime } from '../../lib/relativeTime'
import { ExternalIcon } from '../icons'
import { TextButton } from './TextButton'

const SHOWN = 2

export function SourceChips({ sources }: { sources: SourceCitation[] }) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null
  const extra = sources.length - SHOWN
  return (
    <>
    <ul className="source-chips" aria-label="Sources">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`} className={i >= SHOWN && !open ? 'is-extra' : undefined}>
          <a className="source-chip chip" href={s.url} target="_blank" rel="noopener noreferrer">
            <span>{s.outlet}</span>
            {s.published_at && <span className="source-chip-time mono">{relativeTime(s.published_at)}</span>}
            <ExternalIcon size={11} className="source-chip-ext" />
          </a>
        </li>
      ))}
    </ul>
    {extra > 0 && (
      <TextButton open={open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Show fewer sources' : `${extra} more source${extra === 1 ? '' : 's'}`}
      </TextButton>
    )}
    </>
  )
}
