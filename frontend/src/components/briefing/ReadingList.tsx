import type { ViewReading } from '../../lib/normalize'
import { BookIcon, ExternalIcon } from '../icons'
import { Reveal } from '../Reveal'

export function ReadingList({ readings }: { readings: ViewReading[] }) {
  if (!readings.length) return null
  return (
    <section className="brief-section" aria-labelledby="reading-heading">
      <div className="plate-label" id="reading-heading">
        <BookIcon size={13} /> Recommended reading
      </div>
      <Reveal>
        <ol className="reading-list card">
          {readings.map((r, i) => (
            <li key={`${r.link}-${i}`} className="reading-item">
              <span className="reading-index mono">{String(i + 1).padStart(2, '0')}</span>
              <div className="reading-body">
                <a className="reading-title" href={r.link} target="_blank" rel="noopener noreferrer">
                  {r.title} <ExternalIcon size={12} />
                </a>
                <span className="reading-meta">
                  <span className="reading-outlet mono">{r.publication}</span> — {r.why}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  )
}
