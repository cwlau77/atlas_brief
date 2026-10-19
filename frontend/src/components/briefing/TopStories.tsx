import { useMemo } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { topStories } from '../../lib/topStories'
import { StoryCard } from './StoryCard'

export function TopStories({ briefing, timeZone, onOpen }: {
  briefing: Pick<SavedBriefing, 'keyDevelopments'>
  timeZone: string
  onOpen: (anchorId: string) => void
}) {
  const order = useMemo(() => topStories(briefing.keyDevelopments), [briefing.keyDevelopments])
  if (order.length === 0) return null
  return (
    <section className="top-stories wrap" aria-labelledby="top-stories-h">
      <h2 id="top-stories-h" className="section-label label">Top stories</h2>
      <ol className="story-strip">
        {order.map((i) => (
          <li key={i}>
            <StoryCard dev={briefing.keyDevelopments[i]} index={i} timeZone={timeZone} onOpen={onOpen} />
          </li>
        ))}
      </ol>
    </section>
  )
}
