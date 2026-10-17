import type { ViewReading } from '../../lib/normalize'
import { ExternalIcon } from '../icons'

export function ReadingList({ readings }: { readings: ViewReading[] }) {
  if (!readings.length) return null
  return (
    <section className="reading" aria-labelledby="reading-h">
      <h2 id="reading-h" className="section-label label">Read next</h2>
      <ol className="reading-list">
        {readings.map((r, i) => (
          <li key={`${r.link}-${i}`} className="reading-item">
            <span className="reading-index label">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <a className="reading-title" href={r.link} target="_blank" rel="noopener noreferrer" data-cursor="link">
                {r.title} <ExternalIcon size={12} />
              </a>
              <p className="reading-meta"><span className="label">{r.publication}</span> {r.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
