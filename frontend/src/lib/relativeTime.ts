export function formatDate(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : new Date()
  return parsed.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return 'just now'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'recently'
  const diffMinutes = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}
