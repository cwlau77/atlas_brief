import { describe, expect, it } from 'vitest'
import { flattenSourceCitations, normalizeBriefing } from './normalize'
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
    expect(vm.alerts[0].label).toBe('CRITICAL')
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

  it('joins tension actors with the interchange arrow', () => {
    expect(vm.emergingTensions[0].actors).toBe('India ↔ Pakistan')
  })

  it('keeps the area and generation timestamp', () => {
    expect(vm.area).toBe('south asian security')
    expect(vm.generatedAt).toBe('2026-07-06T10:00:00Z')
  })
})
