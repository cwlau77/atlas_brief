import { useState, type CSSProperties } from 'react'
import type { SavedBriefing, ViewDevelopment } from '../../lib/normalize'
import type { LinkRef } from '../../lib/timeline'
import { ExpandIcon } from '../icons'
import { LinkedTabs, type LinkHandlers } from './LinkedTabs'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'

export function DevelopmentCard({ dev, index, showContext, style, links, briefing, openKeys, onToggleLink, onHoverLink }: LinkHandlers & {
  dev: ViewDevelopment
  index: number
  showContext: boolean
  style?: CSSProperties
  links: LinkRef[]
  briefing: Pick<SavedBriefing, 'emergingTensions' | 'contradictions'>
}) {
  const [contextOpen, setContextOpen] = useState(false)
  const titleId = `dev-${index}-title`
  const contextId = `dev-${index}-context`
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
        <div className="dev-context">
          <span className="label">From the archive</span>
          {contextOpen
            ? <p id={contextId} className="dev-context-full">{dev.historicalContext}</p>
            : <p className="dev-context-teaser" aria-hidden="true">{dev.historicalContext}</p>}
          <button
            type="button"
            className="dev-context-toggle"
            aria-expanded={contextOpen}
            aria-controls={contextOpen ? contextId : undefined}
            onClick={() => setContextOpen((o) => !o)}
            data-cursor="link"
          >
            {contextOpen ? 'Show less' : 'Read background'} <ExpandIcon size={12} open={contextOpen} />
          </button>
        </div>
      )}
      <SourceChips sources={dev.sources} />
      <LinkedTabs
        devIndex={index} links={links} briefing={briefing}
        openKeys={openKeys} onToggleLink={onToggleLink} onHoverLink={onHoverLink}
      />
    </article>
  )
}
