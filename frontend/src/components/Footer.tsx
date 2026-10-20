import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AtlasMark } from './AtlasMark'
import './footer.css'

/** The owner's celadon mountain painting (brandkit/prompts.md), cropped and watermark-free. Decorative. */
export function MountainBand({ height, children }: { height: 'footer' | 'empty'; children?: ReactNode }) {
  return (
    <div className={`mountain-band mountain-band-${height}`}>
      <img
        src="/brand/mountains.jpg"
        srcSet="/brand/mountains.jpg 700w, /brand/mountains@2x.jpg 1400w"
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
      {children}
    </div>
  )
}

const COLUMNS: { title: string; links: { label: string; to: string; state?: object }[] }[] = [
  { title: 'Read', links: [{ label: 'New brief', to: '/', state: { focusAsk: true } }, { label: 'Archive', to: '/archive' }, { label: 'Starred', to: '/archive?filter=starred' }] },
  { title: 'You', links: [{ label: 'Settings', to: '/settings' }, { label: 'Time zone', to: '/settings#time' }] },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-cols">
        {COLUMNS.map((col) => (
          <section key={col.title} className="footer-col">
            <h2 className="label">{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}><Link to={l.to} state={l.state}>{l.label}</Link></li>
              ))}
            </ul>
          </section>
        ))}
        <section className="footer-col">
          <h2 className="label">Project</h2>
          <ul>
            <li><a href="https://github.com/cwlau77/atlas_brief" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">City data © GeoNames (CC BY 4.0)</a></li>
          </ul>
        </section>
        <p className="footer-note">Analysis is model-written. Check it against the cited sources.</p>
      </div>
      <div className="wrap footer-lockup-wrap">
        <Link className="footer-lockup" to="/" aria-label="Atlas home">
          <AtlasMark className="footer-mark" />
          <span aria-hidden="true">atlas</span>
        </Link>
      </div>
      <MountainBand height="footer">
        <div className="wrap footer-base label">
          <span>© 2026 Atlas</span>
          <span>13 sources · last 24 hours</span>
        </div>
      </MountainBand>
    </footer>
  )
}
