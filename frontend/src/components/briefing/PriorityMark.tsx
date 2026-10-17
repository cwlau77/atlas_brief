type Priority = 'high' | 'medium' | 'low'

const LABELS: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

/** Shape plus text, so severity never depends on color alone. */
export function PriorityMark({ priority, label }: { priority: Priority; label?: string }) {
  return (
    <span className={`prio prio-${priority} label`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        {priority === 'high' && <path d="M5 0.5 L9.6 9.5 H0.4 Z" />}
        {priority === 'medium' && <rect x="1" y="1" width="8" height="8" />}
        {priority === 'low' && <circle cx="5" cy="5" r="3.8" strokeWidth="1.6" />}
      </svg>
      {label ?? LABELS[priority]}
    </span>
  )
}
