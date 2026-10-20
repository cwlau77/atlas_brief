import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="page wrap empty-state">
      <img className="brand-object" src="/brand/atlas-mark.svg" alt="" width="96" height="96" />
      <p className="page-kicker label">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="page-lede">That address doesn't match any page in Atlas.</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/">Go to Home</Link>
      </div>
    </section>
  )
}
