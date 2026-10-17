import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/** `?print=1` opens the print dialog once the page has painted, then drops the parameter. */
export function usePrintOnLoad(): void {
  const [params, setParams] = useSearchParams()
  const wantsPrint = params.get('print') === '1'
  useEffect(() => {
    if (!wantsPrint) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setParams((p) => {
          p.delete('print')
          return p
        }, { replace: true })
        window.print()
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [wantsPrint, setParams])
}
