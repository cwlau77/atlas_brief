// Rectangular 4:3 flags from flag-icons (MIT), one SVG file each, keyed by ISO2.
// The URLs are resolved at build time; the SVGs load only when a flag is drawn.
const FILES = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
})

const BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), url]),
)

/** The country's flag (decorative: alt=""), or nothing for a code flag-icons doesn't have. */
export function Flag({ iso2, className }: { iso2: string; className?: string }) {
  const src = BY_CODE[iso2.toLowerCase()]
  if (!src) return null
  return <img className={className ? `hs-flag ${className}` : 'hs-flag'} src={src} alt="" width={16} height={12} />
}
