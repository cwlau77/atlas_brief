// Home's value-prop lede. The counts come from /sources; with none known it prints no number.
import { countWord, liveServiceCount, type SourcesInfo } from '../lib/sources'

export function HomeLede({ info }: { info: SourcesInfo | null }) {
  const reach = info
    ? `${countWord(liveServiceCount(info))} news services and ${countWord(info.feeds.count)} newsroom feeds`
    : 'a range of news services and newsroom feeds'
  return (
    <p className="home-lede">
      Know <em>what changed, where it happened, and who disagrees</em>. Atlas reads across {reach} and
      writes a cited briefing for analysts, writers and anyone who follows world events seriously.
    </p>
  )
}
