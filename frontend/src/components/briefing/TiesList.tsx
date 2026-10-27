import { formatDayMonth } from '../../lib/time'

/** The developments a row draws on, named: headline and date, one line each, a jump to the card. */
export function TiesList({ label, linked, timeZone, onJump }: {
  label: string
  linked: { dev: number; title: string; timestamp: string }[]
  timeZone: string
  onJump: (dev: number) => void
}) {
  return (
    <div className="index-ties">
      <span className="label">{label}</span>
      {linked.length ? (
        <ul>
          {linked.map((l) => (
            <li key={l.dev}>
              <button type="button" aria-label={`Go to development: ${l.title}`} onClick={() => onJump(l.dev)}>
                <span className="index-tie-title">{l.title}</span>
                <time dateTime={l.timestamp}>{formatDayMonth(l.timestamp, timeZone)}</time>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="index-ties-none">Not tied to one development in this brief</p>
      )}
    </div>
  )
}
