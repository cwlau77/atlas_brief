// Faithful port of the legacy normalizeBriefing/flattenSourceCitations
// (index.html:2039-2115). SavedBriefing is the persisted view-model — its shape
// must stay readable by entries already sitting in users' localStorage.

import type { ApiBriefing, Contradiction, SourceCitation } from './types'

export type AlertTone = 'urgent' | 'warning' | 'info'

export interface ViewAlert {
  type: AlertTone
  label: string
  title: string
  description: string
  sources: SourceCitation[]
}

export interface ViewDevelopment {
  title: string
  content: string
  historicalContext: string
  priority: 'high' | 'medium' | 'low'
  regions: string[]
  sources: SourceCitation[]
  timestamp: string
}

export interface ViewTension {
  actors: string
  level: 'high' | 'medium' | 'low'
  description: string
  sources: SourceCitation[]
}

export interface ViewReading {
  title: string
  publication: string
  why: string
  link: string
}

export interface SavedBriefing {
  id: string
  area: string
  frequency: string
  generatedAt: string
  sourceBreakdown: Record<string, number>
  regionCounts: Record<string, number>
  outletCounts: Record<string, number>
  stats: { articles: number; sources: number; regions: number; alerts: number }
  alerts: ViewAlert[]
  keyDevelopments: ViewDevelopment[]
  emergingTensions: ViewTension[]
  contradictions: Contradiction[]
  readingList: ViewReading[]
}

export function flattenSourceCitations(briefing: ApiBriefing): SourceCitation[] {
  const collections: SourceCitation[] = [
    ...(briefing.key_developments || []).flatMap((item) => item.sources || []),
    ...(briefing.emerging_tensions || []).flatMap((item) => item.sources || []),
    ...(briefing.priority_alerts || []).flatMap((item) => item.sources || []),
    ...(briefing.contradictions || []).flatMap((item) => [
      ...(item.sources_a || []),
      ...(item.sources_b || []),
    ]),
    ...(briefing.recommended_readings || []).map((item) => ({
      outlet: item.outlet,
      url: item.url,
      published_at: null,
    })),
  ]
  const seen = new Set<string>()
  return collections.filter((source) => {
    const key = `${source.outlet}|${source.url}`
    if (seen.has(key) || !source.url) return false
    seen.add(key)
    return true
  })
}

export function normalizeBriefing(apiBriefing: ApiBriefing, frequency: string): SavedBriefing {
  const sourceCitations = flattenSourceCitations(apiBriefing)

  const regionCounts: Record<string, number> = {}
  for (const item of apiBriefing.key_developments || []) {
    for (const region of item.regions || []) {
      if (!region) continue
      regionCounts[region] = (regionCounts[region] || 0) + 1
    }
  }

  const outletCounts: Record<string, number> = {}
  for (const source of sourceCitations) {
    const outlet = source.outlet || 'unknown'
    outletCounts[outlet] = (outletCounts[outlet] || 0) + 1
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    area: apiBriefing.focus,
    frequency,
    generatedAt: apiBriefing.generated_at,
    sourceBreakdown: apiBriefing.source_breakdown || {},
    regionCounts,
    outletCounts,
    stats: {
      articles: apiBriefing.article_count || 0,
      sources: sourceCitations.length,
      regions: Object.keys(regionCounts).length,
      alerts: (apiBriefing.priority_alerts || []).length,
    },
    alerts: (apiBriefing.priority_alerts || []).map((alert) => ({
      type: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'warning' : 'info',
      label: alert.severity.toUpperCase(),
      title: alert.headline,
      description: alert.rationale,
      sources: alert.sources || [],
    })),
    keyDevelopments: (apiBriefing.key_developments || []).map((item, index) => ({
      title: item.headline,
      content: item.summary,
      historicalContext: item.historical_context || '',
      priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
      regions: item.regions || [],
      sources: item.sources || [],
      timestamp: item.sources?.[0]?.published_at || apiBriefing.generated_at,
    })),
    emergingTensions: (apiBriefing.emerging_tensions || []).map((item, index) => ({
      actors: (item.actors || []).join(' ↔ ') || 'Multiple actors',
      level: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      description: item.description,
      sources: item.sources || [],
    })),
    contradictions: apiBriefing.contradictions || [],
    readingList: (apiBriefing.recommended_readings || []).map((item) => ({
      title: item.title,
      publication: item.outlet,
      why: item.why,
      link: item.url,
    })),
  }
}
