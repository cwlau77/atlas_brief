// Mirror of the backend API contract (backend/models.py). If a field changes
// there, it changes here — the vitest fixtures in normalize.test.ts will catch
// drift in the shapes the UI actually consumes.

export interface SourceCitation {
  outlet: string
  url: string
  published_at: string | null
}

export interface KeyDevelopment {
  headline: string
  summary: string
  regions: string[]
  sources: SourceCitation[]
  historical_context: string | null
}

export interface Tension {
  description: string
  actors: string[]
  sources: SourceCitation[]
}

export interface Contradiction {
  topic: string
  account_a: string
  account_b: string
  sources_a: SourceCitation[]
  sources_b: SourceCitation[]
}

export type AlertSeverity = 'critical' | 'high' | 'elevated'

export interface PriorityAlert {
  severity: AlertSeverity
  headline: string
  rationale: string
  sources: SourceCitation[]
}

export interface RecommendedReading {
  title: string
  outlet: string
  url: string
  why: string
}

export interface ApiBriefing {
  focus: string
  generated_at: string
  key_developments: KeyDevelopment[]
  emerging_tensions: Tension[]
  contradictions: Contradiction[]
  priority_alerts: PriorityAlert[]
  recommended_readings: RecommendedReading[]
  article_count: number
  source_breakdown: Record<string, number>
}
