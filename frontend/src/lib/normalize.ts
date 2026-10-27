// API briefing -> SavedBriefing, the persisted view-model. Its shape must stay
// readable by entries already sitting in users' localStorage.

import { upperFirst } from './text'
import type { ApiBriefing, ApiPlace, CommonsImage, Contradiction, SourceCitation } from './types'

export type AlertTone = 'urgent' | 'warning' | 'info'

export interface ViewAlert {
  type: AlertTone
  label: string
  title: string
  description: string
  sources: SourceCitation[]
  commonsImage: CommonsImage | null
}

export interface ViewDevelopment {
  title: string
  content: string
  historicalContext: string
  priority: 'high' | 'medium' | 'low'
  regions: string[]
  sources: SourceCitation[]
  timestamp: string
  leadImage: string | null
  place: ApiPlace | null
  commonsImage: CommonsImage | null
}

/** How a tension's actors relate (the API's enum); the words shown live in lib/tensionIndex.ts. */
export type TensionRelationship = 'in_conflict' | 'rivalry' | 'competing_claims' | 'pressure' | 'negotiating' | 'uneasy_partners'

const RELATIONSHIPS: readonly string[] = ['in_conflict', 'rivalry', 'competing_claims', 'pressure', 'negotiating', 'uneasy_partners']

// "A, B and C": no Oxford comma, in keeping with the rest of the copy.
const ACTOR_LIST = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' })

/** Actors as words. Briefings saved before 2026-10-27 joined them with arrows ("A ↔ B"). */
export function actorsText(actors: string): string {
  const parts = actors.split(/\s*↔\s*/)
  return parts.length > 1 ? ACTOR_LIST.format(parts) : actors
}

export interface ViewTension {
  /** Actors as words ("A and B"); older saved briefings hold "A ↔ B", read through actorsText. */
  actors: string
  level: 'high' | 'medium' | 'low'
  description: string
  sources: SourceCitation[]
  relatedDevelopments: number[] | null
  /** Absent in briefings saved before relationships existed. */
  relationship?: TensionRelationship | null
}

export type ViewContradiction = Omit<Contradiction, 'related_developments'> & {
  relatedDevelopments: number[] | null
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
  contradictions: ViewContradiction[]
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
      label: upperFirst(alert.severity),
      title: alert.headline,
      description: alert.rationale,
      sources: alert.sources || [],
      commonsImage: alert.commons_image ?? null,
    })),
    keyDevelopments: (apiBriefing.key_developments || []).map((item, index) => ({
      title: item.headline,
      content: item.summary,
      historicalContext: item.historical_context || '',
      priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
      regions: item.regions || [],
      sources: item.sources || [],
      timestamp: item.sources?.[0]?.published_at || apiBriefing.generated_at,
      leadImage: (item.sources || []).find((s) => s.image_url)?.image_url || null,
      place: item.place || null,
      commonsImage: item.commons_image ?? null,
    })),
    emergingTensions: (apiBriefing.emerging_tensions || []).map((item, index) => ({
      actors: item.actors?.length ? ACTOR_LIST.format(item.actors) : 'Multiple actors',
      level: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      description: item.description,
      sources: item.sources || [],
      relatedDevelopments: item.related_developments ?? null,
      relationship: RELATIONSHIPS.includes(item.relationship ?? '') ? (item.relationship as TensionRelationship) : null,
    })),
    contradictions: (apiBriefing.contradictions || []).map(({ related_developments, ...rest }) => ({
      ...rest,
      relatedDevelopments: related_developments ?? null,
    })),
    readingList: (apiBriefing.recommended_readings || []).map((item) => ({
      title: item.title,
      publication: item.outlet,
      why: item.why,
      link: item.url,
    })),
  }
}

/** Briefings saved before a field existed read back without it; fill the gaps on load. */
export function withDefaults(b: SavedBriefing): SavedBriefing {
  return {
    ...b,
    alerts: (b.alerts ?? []).map((a) => ({ ...a, commonsImage: a.commonsImage ?? null })),
    keyDevelopments: b.keyDevelopments.map((d) => ({
      ...d,
      leadImage: typeof d.leadImage === 'string' ? d.leadImage : null,
      place: d.place ?? null,
      commonsImage: d.commonsImage ?? null,
    })),
    emergingTensions: (b.emergingTensions ?? []).map((t) => ({ ...t, relatedDevelopments: t.relatedDevelopments ?? null })),
    contradictions: (b.contradictions ?? []).map((c) => ({ ...c, relatedDevelopments: c.relatedDevelopments ?? null })),
  }
}
