import type { ViewTension } from '../../lib/normalize'
import type { Contradiction } from '../../lib/types'
import { SourceChips } from './SourceChips'

export const LEVELS: Record<ViewTension['level'], string> = { high: 'High', medium: 'Medium', low: 'Low' }

type Variant = 'card' | 'inline'

/** `card` stands alone ("Also in this briefing"); `inline` sits inside an opened tab on a development. */
export function TensionCard({ id, tension, variant = 'card' }: { id?: string; tension: ViewTension; variant?: Variant }) {
  return (
    <article className={`link-card link-${variant}`} id={id}>
      {variant === 'card' && <p className="link-kind label"><span>Emerging tension</span><span>{LEVELS[tension.level]}</span></p>}
      {variant === 'card' && <h3 className="link-title">{tension.actors}</h3>}
      <p className="link-body">{tension.description}</p>
      <SourceChips sources={tension.sources} />
    </article>
  )
}

export function ContradictionCard({ id, contradiction, variant = 'card' }: { id?: string; contradiction: Contradiction; variant?: Variant }) {
  return (
    <article className={`link-card contra link-${variant}`} id={id}>
      {variant === 'card' && <p className="link-kind label"><span>Sources disagree</span><span>2 accounts</span></p>}
      {variant === 'card' && <h3 className="link-title">{contradiction.topic}</h3>}
      <div className="contra-accounts">
        <div>
          <span className="label">Account A</span>
          <p className="link-body">{contradiction.account_a}</p>
          <SourceChips sources={contradiction.sources_a} />
        </div>
        <div>
          <span className="label">Account B</span>
          <p className="link-body">{contradiction.account_b}</p>
          <SourceChips sources={contradiction.sources_b} />
        </div>
      </div>
    </article>
  )
}
