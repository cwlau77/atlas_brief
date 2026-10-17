import type { SourceCitation } from '../../lib/types'
import { relativeTime } from '../../lib/relativeTime'
import { ExternalIcon } from '../icons'

export function SourceChips({ sources }: { sources: SourceCitation[] }) {
  if (!sources.length) return null
  return (
    <ul className="source-chips" aria-label="Sources">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`}>
          <a className="source-chip" href={s.url} target="_blank" rel="noopener noreferrer" data-cursor="link">
            <span>{s.outlet}</span>
            {s.published_at && <span className="source-chip-time mono">{relativeTime(s.published_at)}</span>}
            <ExternalIcon size={11} className="source-chip-ext" />
          </a>
        </li>
      ))}
    </ul>
  )
}
