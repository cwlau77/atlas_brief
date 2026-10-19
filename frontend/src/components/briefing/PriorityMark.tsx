import { AlertCriticalIcon, AlertElevatedIcon, AlertHighIcon } from '../icons'

type Priority = 'high' | 'medium' | 'low'

const LABELS: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }
const ICON = { high: AlertCriticalIcon, medium: AlertHighIcon, low: AlertElevatedIcon }

/** Shape plus text, so severity never depends on color alone. */
export function PriorityMark({ priority, label }: { priority: Priority; label?: string }) {
  const Icon = ICON[priority]
  return (
    <span className={`prio prio-${priority} label`}>
      <Icon size={12} />
      {label ?? LABELS[priority]}
    </span>
  )
}
