import { upperFirst } from '../../lib/text'

type Priority = 'high' | 'medium' | 'low'

const LABELS: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

/** Square plus text, so severity never depends on color alone. */
export function PriorityMark({ priority, label }: { priority: Priority; label?: string }) {
  return (
    <span className={`prio prio-${priority} label`}>
      <span className="prio-square" aria-hidden="true" />
      {label ? upperFirst(label.toLowerCase()) : LABELS[priority]}
    </span>
  )
}
