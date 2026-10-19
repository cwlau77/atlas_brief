import { useCallback, useMemo, useState } from 'react'

export interface RouteHighlight {
  openKeys: Set<string>
  toggle: (key: string) => void
  hovered: string | null
  setHovered: (key: string | null) => void
  /** Opened links plus the hovered one: what the timeline, key, tabs and globe arcs light. */
  lit: Set<string>
}

/** Story-tab link highlight, shared by the timeline routes, key, tabs and globe arcs. */
export function useRouteHighlight(): RouteHighlight {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())
  const [hovered, setHovered] = useState<string | null>(null)
  const toggle = useCallback((key: string) => setOpenKeys((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  }), [])
  const lit = useMemo(() => new Set(hovered ? [...openKeys, hovered] : openKeys), [hovered, openKeys])
  return { openKeys, toggle, hovered, setHovered, lit }
}
