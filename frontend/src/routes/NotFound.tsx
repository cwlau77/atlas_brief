import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="page wrap empty-state">
      <p className="page-kicker label">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="page-lede">That address doesn't match any page in Atlas Brief.</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/" data-cursor="link">Go to Home</Link>
      </div>
    </section>
  )
}
