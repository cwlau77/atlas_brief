// The Atlas mark: a map folded in three, shaded in ultramarine, with a
// red fix at the peak. Geometry and colours are fixed by the brand spec.
type Palette = { left: string; centre: string; right: string; fix: string }

export const ATLAS_MARK_PALETTES: { default: Palette; reversed: Palette } = {
  default: { left: '#AEBBF5', centre: '#5A73EA', right: '#1F3FE0', fix: '#E2381B' },
  reversed: { left: '#D5DCFA', centre: '#8FA2F3', right: '#5A73EA', fix: '#FF6A4D' },
}

export function AtlasMark({ reversed = false, title, className }: {
  reversed?: boolean
  title?: string
  className?: string
}) {
  const p = reversed ? ATLAS_MARK_PALETTES.reversed : ATLAS_MARK_PALETTES.default
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path data-part="left" d="M8 84 L36 20 L36 76Z" fill={p.left} />
      <path data-part="centre" d="M36 20 L64 32 L64 88 L36 76Z" fill={p.centre} />
      <path data-part="right" d="M64 32 L92 84 L64 88Z" fill={p.right} />
      <circle data-part="fix" cx="36" cy="13" r="5" fill={p.fix} />
    </svg>
  )
}
