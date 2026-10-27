// Mirror of the backend API contract (backend/models.py). If a field changes
// there, it changes here — the vitest fixtures in normalize.test.ts will catch
// drift in the shapes the UI actually consumes.

export interface SourceCitation {
  outlet: string
  url: string
  published_at: string | null
  image_url?: string | null
  /** Who the image came from, when it differs from `outlet` (dedupe can hand an image to another copy). */
  image_outlet?: string | null
}

export interface CommonsImage {
  url: string
  page_url: string
  author: string
  license: string
  source: 'commons'
}

export interface ApiPlace {
  name: string
  country: string
  lat: number
  lng: number
}

export interface KeyDevelopment {
  headline: string
  summary: string
  regions: string[]
  sources: SourceCitation[]
  historical_context: string | null
  place?: ApiPlace | null
  commons_image?: CommonsImage | null
}

export interface Tension {
  description: string
  actors: string[]
  sources: SourceCitation[]
  /** Zero-based indexes into key_developments; null/absent when the link call did not run. */
  related_developments?: number[] | null
  /** How the actors relate: one of the backend's six values; absent in older briefings. */
  relationship?: string | null
}

export interface Contradiction {
  topic: string
  account_a: string
  account_b: string
  sources_a: SourceCitation[]
  sources_b: SourceCitation[]
  related_developments?: number[] | null
}

export type AlertSeverity = 'critical' | 'high' | 'elevated'

export interface PriorityAlert {
  severity: AlertSeverity
  headline: string
  rationale: string
  sources: SourceCitation[]
  commons_image?: CommonsImage | null
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
