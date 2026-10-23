import { describe, expect, it } from 'vitest'
import { FEED_CITIES, feedCity } from './feedCities'

// backend/ingestion/rss_source.py RSS_FEEDS names, as Article.source carries them.
const FEED_NAMES = [
  'BBC World', 'Al Jazeera', 'The Guardian World', 'NPR World', 'The Hindu', 'Deutsche Welle', 'France 24',
  'AllAfrica', 'Straits Times', 'CNN World', 'Fox News World', 'New York Times World', 'ABC News International',
  'CBS News World', 'NPR News', 'New York Times U.S.', 'New York Times Technology', 'Axios', 'Politico',
  'The Verge', 'Ars Technica', 'Wired', 'MarketWatch', 'CNBC Top News', 'Investing.com', 'Financial Times',
]

describe('feedCity', () => {
  it('places every newsroom feed', () => {
    for (const name of FEED_NAMES) expect(feedCity(name), name).not.toBeNull()
  })

  it('puts all of an outlet’s feeds in one city', () => {
    expect(feedCity('New York Times World')).toEqual(feedCity('New York Times Technology'))
    expect(feedCity('NPR News')).toEqual(feedCity('NPR World'))
  })

  it('has one city per distinct outlet', () => {
    expect(Object.keys(FEED_CITIES)).toHaveLength(23)
  })

  it('places nothing it does not know', () => {
    expect(feedCity('Reuters')).toBeNull()
  })
})
