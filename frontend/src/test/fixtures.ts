// Shared test data: a small Red Sea briefing that exercises regions, links,
// untimed sources, an unmatched tension, a lead image and a named city (Aden).
import { normalizeBriefing, type SavedBriefing } from '../lib/normalize'
import type { ApiBriefing } from '../lib/types'

export const API_FIXTURE: ApiBriefing = {
  focus: 'red sea shipping',
  generated_at: '2026-10-16T14:32:00Z',
  key_developments: [
    {
      headline: 'Drone strike damages tanker near Bab el-Mandeb',
      summary: 'A tanker reported a fire after a drone hit its port side.',
      regions: ['Yemen', 'Red Sea'],
      sources: [
        { outlet: 'Reuters', url: 'https://r.eu/1', published_at: '2026-10-16T02:10:00Z', image_url: 'https://img.r.eu/1.jpg' },
        { outlet: "Lloyd's List", url: 'https://ll.com/2', published_at: '2026-10-16T02:40:00Z' },
      ],
      historical_context: 'First confirmed hit since June.',
      place: { name: 'Aden', country: 'Yemen', lat: 12.78, lng: 45.04 },
    },
    {
      headline: 'Carriers extend Cape of Good Hope routing',
      summary: 'Two carriers extend routing around Africa through the first quarter.',
      regions: ['Red Sea', 'South Africa'],
      sources: [{ outlet: 'Financial Times', url: 'https://ft.com/3', published_at: '2026-10-16T05:45:00Z' }],
      historical_context: null,
    },
    {
      headline: 'Suez Canal revenue falls 41%',
      summary: 'Monthly figures show transits down sharply.',
      regions: ['Egypt'],
      sources: [{ outlet: 'Ahram Online', url: 'https://ahram.eg/4', published_at: null }],
      historical_context: null,
    },
  ],
  emerging_tensions: [
    { description: 'Escort rules are under review after the strike off Yemen.', actors: ['Houthi forces', 'EU-US coalition'], sources: [] },
    { description: 'Cairo presses carriers to return with toll discounts.', actors: ['Egypt', 'Container lines'], sources: [] },
    { description: 'Grain exporters weigh insurance costs.', actors: ['Ukraine', 'Insurers'], sources: [] },
  ],
  contradictions: [
    { topic: 'Tanker damage off Yemen', account_a: 'Minor damage.', account_b: 'Hull breach.', sources_a: [], sources_b: [] },
  ],
  priority_alerts: [
    { severity: 'critical', headline: 'Strike ends four-month lull', rationale: 'Shipping risk rises.', sources: [] },
  ],
  recommended_readings: [
    { title: 'Why the Cape route costs more', outlet: 'The Economist', url: 'https://econ.com/5', why: 'Explains the cost math.' },
  ],
  article_count: 214,
  source_breakdown: { newsapi: 98, gdelt: 66, rss: 50 },
}

export function makeBriefing(overrides: Partial<SavedBriefing> = {}): SavedBriefing {
  return { ...normalizeBriefing(API_FIXTURE, 'daily'), id: 'b-1', ...overrides }
}
