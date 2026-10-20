import { useMemo } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { topStories } from '../../lib/topStories'
import { StoryCard } from './StoryCard'

/** A full-width row of photo cards for the briefing's top stories. */
export function TopStories({ briefing, timeZone, onOpen }: {
  briefing: Pick<SavedBriefing, 'keyDevelopments'>
  timeZone: string
  onOpen: (anchorId: string) => void
}) {
  const order = useMemo(() => topStories(briefing.keyDevelopments), [briefing.keyDevelopments])
  if (order.length === 0) return null
  return (
    <section className="top-stories wrap" aria-labelledby="top-stories-h">
      <h2 id="top-stories-h" className="section-label label label-mark">Top stories</h2>
      <ol className="story-strip">
        {order.map((i) => (
          <li key={i}>
            <StoryCard dev={briefing.keyDevelopments[i]} index={i} timeZone={timeZone} onOpen={onOpen} variant="strip" />
          </li>
        ))}
      </ol>
    </section>
  )
}
