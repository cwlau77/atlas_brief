import { useOutletContext } from 'react-router'
import type { SavedBriefing } from '../lib/normalize'

export interface BriefingOutletContext {
  briefing: SavedBriefing
}

export function useBriefing(): SavedBriefing {
  return useOutletContext<BriefingOutletContext>().briefing
}
