import { Link } from 'react-router'

export function UnsavedBriefing() {
  return (
    <section className="page wrap empty-state">
      <p className="page-kicker label">Briefing not found</p>
      <h1 className="page-title">This briefing isn't saved on this device</h1>
      <p className="page-lede">
        Briefings are stored in this browser. It may have been removed from your archive, or the link came from another device.
      </p>
      <div className="actions">
        <Link className="btn btn-primary" to="/">Start a new brief</Link>
        <Link className="btn btn-quiet" to="/archive">Open the archive</Link>
      </div>
    </section>
  )
}
