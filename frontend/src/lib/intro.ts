// First-load intro: once per browser session, never with reduced motion.
// The decision is memoized per page load so StrictMode double renders agree.
const KEY = 'atlasIntroSeen'
let decision: boolean | null = null

export function shouldPlayIntro(reduced: boolean): boolean {
  if (decision === null) {
    let seen = true
    try {
      seen = window.sessionStorage.getItem(KEY) === '1'
    } catch {
      seen = true
    }
    decision = !reduced && !seen
  }
  return decision
}

export function markIntroPlayed(): void {
  decision = false
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the intro may replay next load, which is harmless
  }
}
