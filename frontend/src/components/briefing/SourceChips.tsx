import type { SourceCitation } from '../../lib/types'
import { relativeTime } from '../../lib/relativeTime'
import { ExternalIcon } from '../icons'

export function SourceChips({ sources }: { sources: SourceCitation[] }) {
  if (!sources.length) return null
  return (
    <div className="source-chips">
      {sources.map((s, i) => (
        <a
          key={`${s.url}-${i}`}
          className="source-chip"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="source-chip-outlet">{s.outlet}</span>
          {s.published_at && <span className="source-chip-time mono">{relativeTime(s.published_at)}</span>}
          <ExternalIcon size={11} className="source-chip-ext" />
        </a>
      ))}
    </div>
  )
}
