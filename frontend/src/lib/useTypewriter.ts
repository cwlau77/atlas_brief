import { useEffect, useState } from 'react'

/** Types and deletes example prompts in a placeholder. Pauses while the target input is focused or filled. */
export function useTypewriter(prompts: readonly string[], opts: { enabled: boolean; pauseWhenFocusedId?: string }): string {
  const { enabled, pauseWhenFocusedId } = opts
  const [text, setText] = useState(prompts[0] ?? '')
  useEffect(() => {
    if (!enabled || prompts.length === 0) {
      setText(prompts[0] ?? '')
      return
    }
    let pi = 0, ci = prompts[0].length, dir = -1, hold = 40
    const t = window.setInterval(() => {
      const el = pauseWhenFocusedId ? (document.getElementById(pauseWhenFocusedId) as HTMLInputElement | null) : null
      if (el && (document.activeElement === el || el.value)) return
      if (hold > 0) { hold--; return }
      ci += dir
      if (ci <= 0) { dir = 1; pi = (pi + 1) % prompts.length; ci = 0; hold = 3 }
      if (ci >= prompts[pi].length) { dir = -1; ci = prompts[pi].length; hold = 45 }
      setText(prompts[pi].slice(0, ci) + (ci < prompts[pi].length ? '▍' : ''))
    }, 55)
    return () => window.clearInterval(t)
  }, [enabled, prompts, pauseWhenFocusedId])
  return text
}
