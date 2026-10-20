/** Capitalise the first character of a display string (user focus phrases arrive lower-case). */
export function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
