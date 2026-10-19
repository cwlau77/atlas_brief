import type { SavedBriefing } from '../../lib/normalize'
import type { LinkRef } from '../../lib/timeline'
import { DisagreeIcon, TensionIcon } from '../icons'
import { ContradictionCard, LEVELS, TensionCard } from './LinkedCards'

export interface LinkHandlers {
  openKeys: Set<string>
  onToggleLink: (key: string) => void
  onHoverLink: (key: string | null) => void
}

/** The tab row at the foot of a development: one tab per linked tension or disagreement, opening in place. */
export function LinkedTabs({ devIndex, links, briefing, openKeys, onToggleLink, onHoverLink }: LinkHandlers & {
  devIndex: number
  links: LinkRef[]
  briefing: Pick<SavedBriefing, 'emergingTensions' | 'contradictions'>
}) {
  if (!links.length) return null
  const panelId = (l: LinkRef) => `dev-${devIndex}-${l.key}`
  return (
    <div className="dev-links">
      <div className="dev-tabs">
        {links.map((l) => {
          const isOpen = openKeys.has(l.key)
          const tension = l.kind === 'tension' ? briefing.emergingTensions[l.i] : null
          const contra = l.kind === 'contradiction' ? briefing.contradictions[l.i] : null
          return (
            <button
              key={l.key}
              type="button"
              className={`dev-tab ${isOpen ? 'open' : ''}`}
              aria-expanded={isOpen}
              aria-controls={panelId(l)}
              data-link={l.key}
              onClick={() => onToggleLink(l.key)}
              onMouseEnter={() => onHoverLink(l.key)}
              onMouseLeave={() => onHoverLink(null)}
              onFocus={() => onHoverLink(l.key)}
              onBlur={() => onHoverLink(null)}
              data-cursor="link"
            >
              {tension ? <TensionIcon size={14} /> : <DisagreeIcon size={14} />}
              <span className="dev-tab-kind label">
                {tension ? `Tension · ${LEVELS[tension.level]}` : 'Sources disagree · 2 accounts'}
              </span>
              <span className="dev-tab-title">{tension ? tension.actors : contra?.topic}</span>
            </button>
          )
        })}
      </div>
      {/* Closed panels stay in the DOM, hidden, so print can show every link expanded. */}
      {links.map((l) => (
        <div key={l.key} id={panelId(l)} className="dev-tab-panel" hidden={!openKeys.has(l.key)}>
          {l.kind === 'tension'
            ? <TensionCard tension={briefing.emergingTensions[l.i]} variant="inline" />
            : <ContradictionCard contradiction={briefing.contradictions[l.i]} variant="inline" />}
        </div>
      ))}
    </div>
  )
}
