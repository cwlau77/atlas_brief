import { useMemo } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { topStories } from '../../lib/topStories'
import { StoryCard } from './StoryCard'

// Beside the globe there's room for four compact cards (about the globe's height).
const STACK_LIMIT = 4

/** `strip`: a full-width row of photo cards. `stack`: compact cards in the lead column beside the globe. */
export function TopStories({ briefing, timeZone, onOpen, layout = 'strip' }: {
  briefing: Pick<SavedBriefing, 'keyDevelopments'>
  timeZone: string
  onOpen: (anchorId: string) => void
  layout?: 'strip' | 'stack'
}) {
  const stack = layout === 'stack'
  const order = useMemo(
    () => topStories(briefing.keyDevelopments, stack ? STACK_LIMIT : undefined),
    [briefing.keyDevelopments, stack],
  )
  if (order.length === 0) return null
  return (
    <section className={stack ? 'top-stories top-stories-stack' : 'top-stories wrap'} aria-labelledby="top-stories-h">
      <h2 id="top-stories-h" className="section-label label label-mark">Top stories</h2>
      <ol className={stack ? 'story-stack' : 'story-strip'}>
        {order.map((i) => (
          <li key={i}>
            <StoryCard dev={briefing.keyDevelopments[i]} index={i} timeZone={timeZone} onOpen={onOpen} variant={stack ? 'compact' : 'strip'} />
          </li>
        ))}
      </ol>
    </section>
  )
}
