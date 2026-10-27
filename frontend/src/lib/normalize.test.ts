import { describe, expect, it } from 'vitest'
import { isSavedBriefing } from '../state/resolveBriefing'
import { actorsText, flattenSourceCitations, normalizeBriefing, withDefaults, type SavedBriefing } from './normalize'
import type { ApiBriefing } from './types'

const FIXTURE: ApiBriefing = {
  focus: 'south asian security',
  generated_at: '2026-07-06T10:00:00Z',
  key_developments: [
    {
      headline: 'Border talks resume',
      summary: 'Delegations met for the first time in months.',
      regions: ['India', 'Pakistan'],
      sources: [
        { outlet: 'BBC World', url: 'https://b.bc/1', published_at: '2026-07-06T08:00:00Z' },
        { outlet: 'The Hindu', url: 'https://th.in/2', published_at: null },
      ],
      historical_context: 'Talks have collapsed twice since 2021.',
    },
    {
      headline: 'Naval drills announced',
      summary: 'Exercises scheduled near disputed waters.',
      regions: ['India'],
      sources: [{ outlet: 'BBC World', url: 'https://b.bc/1', published_at: null }], // duplicate citation
      historical_context: null,
    },
  ],
  emerging_tensions: [
    {
      description: 'Rhetoric sharpening ahead of elections.',
      actors: ['India', 'Pakistan'],
      sources: [{ outlet: 'Al Jazeera', url: 'https://aj.z/3', published_at: null }],
    },
  ],
  contradictions: [
    {
      topic: 'Casualty figures',
      account_a: 'Officials report two injured.',
      account_b: 'Local media report seven injured.',
      sources_a: [{ outlet: 'NPR World', url: 'https://np.r/4', published_at: null }],
      sources_b: [{ outlet: 'Dawn', url: 'https://da.wn/5', published_at: null }],
    },
  ],
  priority_alerts: [
    { severity: 'critical', headline: 'Shelling reported', rationale: 'Escalation risk.', sources: [] },
    { severity: 'high', headline: 'Supply routes cut', rationale: 'Humanitarian impact.', sources: [] },
    { severity: 'elevated', headline: 'Cyber activity rises', rationale: 'Monitoring advised.', sources: [] },
  ],
  recommended_readings: [
    { title: 'Long read', outlet: 'Guardian', url: 'https://gu.ar/6', why: 'Context.' },
  ],
  article_count: 18,
  source_breakdown: { newsapi: 8, gdelt: 6, rss: 4 },
}

describe('flattenSourceCitations', () => {
  it('dedupes by outlet+url and includes readings', () => {
    const flat = flattenSourceCitations(FIXTURE)
    const urls = flat.map((s) => s.url)
    expect(urls).toEqual(['https://b.bc/1', 'https://th.in/2', 'https://aj.z/3',
      'https://np.r/4', 'https://da.wn/5', 'https://gu.ar/6'])
  })
})

describe('normalizeBriefing', () => {
  const vm = normalizeBriefing(FIXTURE, 'daily')

  it('maps severities to legacy tones', () => {
    expect(vm.alerts.map((a) => a.type)).toEqual(['urgent', 'warning', 'info'])
    expect(vm.alerts[0].label).toBe('Critical')
  })

  it('counts regions across developments', () => {
    expect(vm.regionCounts).toEqual({ India: 2, Pakistan: 1 })
    expect(vm.stats.regions).toBe(2)
  })

  it('computes stats from the payload', () => {
    expect(vm.stats.articles).toBe(18)
    expect(vm.stats.sources).toBe(6)
    expect(vm.stats.alerts).toBe(3)
  })

  it('assigns development priority by position', () => {
    expect(vm.keyDevelopments.map((d) => d.priority)).toEqual(['high', 'medium'])
    expect(vm.keyDevelopments[0].historicalContext).toContain('2021')
  })

  it('keeps the area and generation timestamp', () => {
    expect(vm.area).toBe('south asian security')
    expect(vm.generatedAt).toBe('2026-07-06T10:00:00Z')
  })
})

describe('lead images and places', () => {
  const withMedia: ApiBriefing = {
    ...FIXTURE,
    key_developments: [
      {
        ...FIXTURE.key_developments[0],
        sources: [
          { outlet: 'BBC World', url: 'https://b.bc/1', published_at: null },
          { outlet: 'The Hindu', url: 'https://th.in/2', published_at: null, image_url: 'https://img.th/2.jpg' },
          { outlet: 'Dawn', url: 'https://da.wn/9', published_at: null, image_url: 'https://img.da/9.jpg' },
        ],
        place: { name: 'Islamabad', country: 'Pakistan', lat: 33.72, lng: 73.04 },
      },
      FIXTURE.key_developments[1],
    ],
  }

  it('takes the first source image in citation order as the lead image', () => {
    const b = normalizeBriefing(withMedia, 'daily')
    expect(b.keyDevelopments[0].leadImage).toBe('https://img.th/2.jpg')
    expect(b.keyDevelopments[1].leadImage).toBeNull()
  })

  it('passes the place through, or null', () => {
    const b = normalizeBriefing(withMedia, 'daily')
    expect(b.keyDevelopments[0].place).toEqual({ name: 'Islamabad', country: 'Pakistan', lat: 33.72, lng: 73.04 })
    expect(b.keyDevelopments[1].place).toBeNull()
  })

  it('fills missing leadImage and place on an old saved briefing', () => {
    const current = normalizeBriefing(FIXTURE, 'daily')
    const old = JSON.parse(JSON.stringify({
      ...current,
      keyDevelopments: current.keyDevelopments.map(({ leadImage: _l, place: _p, ...rest }) => rest),
    })) as unknown
    expect(isSavedBriefing(old)).toBe(true)
    const loaded = withDefaults(old as SavedBriefing)
    expect(loaded.keyDevelopments.map((d) => [d.leadImage, d.place])).toEqual([[null, null], [null, null]])
    expect(loaded.keyDevelopments[0].title).toBe('Border talks resume')
  })
})

describe('commons images', () => {
  const commons = {
    url: 'https://upload.wikimedia.org/x.jpg',
    page_url: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    source: 'commons' as const,
  }

  it('carries commons_image through for developments and alerts, or null', () => {
    const api: ApiBriefing = {
      ...FIXTURE,
      key_developments: [{ ...FIXTURE.key_developments[0], commons_image: commons }, FIXTURE.key_developments[1]],
      priority_alerts: [{ ...FIXTURE.priority_alerts[0], commons_image: commons }, FIXTURE.priority_alerts[1]],
    }
    const b = normalizeBriefing(api, 'daily')
    expect(b.keyDevelopments.map((d) => d.commonsImage)).toEqual([commons, null])
    expect(b.alerts.map((a) => a.commonsImage)).toEqual([commons, null])
  })

  it('normalizes legacy saved briefing without image fields', () => {
    const current = normalizeBriefing(FIXTURE, 'daily')
    const old = JSON.parse(JSON.stringify({
      ...current,
      keyDevelopments: current.keyDevelopments.map(({ commonsImage: _c, ...rest }) => rest),
      alerts: current.alerts.map(({ commonsImage: _c, ...rest }) => rest),
    })) as SavedBriefing
    const loaded = withDefaults(old)
    expect(loaded.keyDevelopments.every((d) => d.commonsImage === null)).toBe(true)
    expect(loaded.alerts.every((a) => a.commonsImage === null)).toBe(true)
  })
})

describe('related developments', () => {
  it('carries related_developments as relatedDevelopments', () => {
    const api: ApiBriefing = {
      ...FIXTURE,
      emerging_tensions: [{ ...FIXTURE.emerging_tensions[0], related_developments: [1, 0] }],
      contradictions: [{ ...FIXTURE.contradictions[0], related_developments: [] }],
    }
    const b = normalizeBriefing(api, 'daily')
    expect(b.emergingTensions[0].relatedDevelopments).toEqual([1, 0])
    expect(b.contradictions[0].relatedDevelopments).toEqual([])
    expect(b.contradictions[0]).not.toHaveProperty('related_developments')
  })

  it('maps a missing field to null on both', () => {
    const b = normalizeBriefing(FIXTURE, 'daily')
    expect(b.emergingTensions[0].relatedDevelopments).toBeNull()
    expect(b.contradictions[0].relatedDevelopments).toBeNull()
  })

  it('withDefaults fills relatedDevelopments with null', () => {
    const current = normalizeBriefing(FIXTURE, 'daily')
    const old = JSON.parse(JSON.stringify({
      ...current,
      emergingTensions: current.emergingTensions.map(({ relatedDevelopments: _r, ...rest }) => rest),
      contradictions: current.contradictions.map(({ relatedDevelopments: _r, ...rest }) => rest),
    })) as SavedBriefing
    const loaded = withDefaults(old)
    expect(loaded.emergingTensions[0].relatedDevelopments).toBeNull()
    expect(loaded.contradictions[0].relatedDevelopments).toBeNull()
  })
})

describe('tension relationship and actors', () => {
  const tension = (actors: string[], relationship?: string | null) => ({ description: 'D', actors, sources: [], relationship })
  const view = (tensions: ReturnType<typeof tension>[]) =>
    normalizeBriefing({ ...FIXTURE, emerging_tensions: tensions }, 'daily').emergingTensions

  it('maps a known relationship and drops an unknown or missing one', () => {
    const ts = view([tension(['A'], 'rivalry'), tension(['A'], 'war'), tension(['A'], null), tension(['A'])])
    expect(ts.map((t) => t.relationship)).toEqual(['rivalry', null, null, null])
  })

  it('writes actors as words', () => {
    const ts = view([tension(['Egypt']), tension(['A', 'B']), tension(['A', 'B', 'C']), tension([])])
    expect(ts.map((t) => t.actors)).toEqual(['Egypt', 'A and B', 'A, B and C', 'Multiple actors'])
  })

  it('actorsText reformats a legacy arrow string and leaves words alone', () => {
    expect(actorsText('A ↔ B ↔ C')).toBe('A, B and C')
    expect(actorsText('A ↔ B')).toBe('A and B')
    expect(actorsText('A and B')).toBe('A and B')
  })
})
