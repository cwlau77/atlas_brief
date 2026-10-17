import type { CSSProperties } from 'react'
import type { ViewDevelopment } from '../../lib/normalize'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'

export function DevelopmentCard({ dev, index, showContext, style }: {
  dev: ViewDevelopment
  index: number
  showContext: boolean
  style?: CSSProperties
}) {
  const titleId = `dev-${index}-title`
  return (
    <article className="dev" id={`dev-${index}`} style={style} aria-labelledby={titleId}>
      <div className="dev-top">
        <PriorityMark priority={dev.priority} />
        {dev.regions.length > 0 && (
          <ul className="tags label" aria-label="Regions">
            {dev.regions.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>
      <h3 id={titleId} className="dev-title">{dev.title}</h3>
      <p className="dev-body">{dev.content}</p>
      {showContext && dev.historicalContext && (
        <p className="dev-context">
          <span className="label">From the archive</span>
          {dev.historicalContext}
        </p>
      )}
      <SourceChips sources={dev.sources} />
    </article>
  )
}
