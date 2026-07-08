import { motion, useReducedMotion } from 'framer-motion'
import type { ViewAlert } from '../../lib/normalize'
import { useSpotlight } from '../../lib/useSpotlight'
import { SourceChips } from './SourceChips'

export function PriorityAlerts({ alerts }: { alerts: ViewAlert[] }) {
  const reduced = useReducedMotion()
  const spot = useSpotlight()
  if (!alerts.length) return null
  return (
    <section className="brief-section" aria-labelledby="alerts-heading">
      <div className="signal-label" id="alerts-heading">
        <span className="label-index" aria-hidden>01</span> Priority alerts
      </div>
      <div className="alert-stack">
        {alerts.map((alert, i) => (
          <motion.article
            key={`${alert.title}-${i}`}
            className={`panel spot alert-card alert-${alert.type}`}
            onMouseMove={spot}
            initial={reduced ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: i * 0.08 }}
          >
            <span className={`alert-stamp mono stamp-${alert.type}`}>{alert.label}</span>
            <div className="alert-body">
              <h3 className="alert-title">{alert.title}</h3>
              <p className="alert-rationale">{alert.description}</p>
              <SourceChips sources={alert.sources} />
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
