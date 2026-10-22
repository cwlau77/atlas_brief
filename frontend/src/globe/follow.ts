// The globe follows the reader: a pure state machine that turns card hover, focus
// and one-off requests plus the tension index's preview and pin into one camera target.
// Timers keep it calm: a card or index row must hold the pointer for the dwell before
// the globe moves, and stepping down to the pin (or the overview) waits out the leave.
// A request (a card tap or region tag, or a story jump) shows its card at once on every
// device and beats focus and hover. Each carries a new seq, so asking for the same card
// again counts. The newest intent wins: a pin or preview change retires the card being
// hovered or requested at that moment. On desktop, so does keyboard focus moving to a
// different card, or the pointer resting on one for the dwell. Leaving the card, or
// passing over another without dwelling, does not retire a request.

export interface LatLng { lat: number; lng: number }
export type FollowRequest = { dev: number; seq: number } | null
export type FollowTarget = { points: LatLng[]; markerKey: string | null } | null

export interface FollowInput {
  hoveredDev: number | null
  focusedDev: number | null
  request: FollowRequest
  previewItem: string | null
  pinnedItem: string | null
  carouselOpen: boolean
  touch: boolean
}

export interface FollowOptions {
  resolve: (dev: number) => { lat: number; lng: number; markerKey: string } | null
  itemDevs: (key: string) => number[]
  dwellMs?: number
  leaveMs?: number
  onTarget: (t: FollowTarget) => void
}

// Strength of what the target came from; stepping down waits out leaveMs.
const NONE = 0, PINNED = 1, PREVIEW = 2, CARD = 3

const EMPTY: FollowInput = {
  hoveredDev: null, focusedDev: null, request: null, previewItem: null, pinnedItem: null, carouselOpen: false, touch: false,
}

const keyOf = (t: FollowTarget) => (t ? `${t.markerKey}|${t.points.map((p) => `${p.lat},${p.lng}`).join(';')}` : 'null')

export function createFollow(opts: FollowOptions): { update(input: FollowInput): void; dispose(): void } {
  const dwellMs = opts.dwellMs ?? 250
  const leaveMs = opts.leaveMs ?? 400
  let input = EMPTY
  let dwelled: number | null = null
  let dwellTimer: ReturnType<typeof setTimeout> | undefined
  let previewDwelled: string | null = null
  let previewTimer: ReturnType<typeof setTimeout> | undefined
  // The hovered card and the request seq retired by a newer intent; -1 is none.
  let staleHover = -1
  let staleSeq = -1
  // A deliberate pin change skips the leave wait once.
  let fresh = false
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  let left = false
  // The globe starts on its overview, so an initial null is not news.
  let lastKey: string | null = 'null'
  let rank = NONE
  let disposed = false

  const clearLeave = () => {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
    left = false
  }

  const emit = (t: FollowTarget, r: number) => {
    rank = r
    const k = keyOf(t)
    if (k === lastKey) return
    lastKey = k
    opts.onTarget(t)
  }

  const itemTarget = (key: string | null): FollowTarget => {
    if (!key) return null
    const seen = new Set<string>()
    const hits = opts.itemDevs(key).flatMap((d) => {
      const r = opts.resolve(d)
      if (!r || seen.has(r.markerKey)) return []
      seen.add(r.markerKey)
      return [r]
    })
    if (!hits.length) return null
    return { points: hits.map(({ lat, lng }) => ({ lat, lng })), markerKey: hits.length === 1 ? hits[0].markerKey : null }
  }

  const compute = () => {
    if (disposed) return
    if (input.carouselOpen) {
      // The carousel owns the camera; forget what we showed so closing re-emits.
      clearLeave()
      lastKey = null
      rank = NONE
      return
    }
    const hovered = input.hoveredDev !== null && input.hoveredDev !== staleHover ? input.hoveredDev : null
    const request = input.request && input.request.seq !== staleSeq ? input.request.dev : null
    const card = request ?? (input.touch
      ? null
      : input.focusedDev ?? (hovered !== null && dwelled === hovered ? hovered : null))
    if (card !== null) {
      clearLeave()
      const r = opts.resolve(card)
      if (r) {
        fresh = false
        emit({ points: [{ lat: r.lat, lng: r.lng }], markerKey: r.markerKey }, CARD)
      }
      return
    }
    // A card still dwelling holds whatever the globe shows now, so sweeping never lurches.
    // So does an index row still dwelling.
    const pending = (!input.touch && hovered !== null) || (input.previewItem !== null && previewDwelled !== input.previewItem)
    if (pending) {
      clearLeave()
      return
    }
    let target = itemTarget(input.previewItem)
    let r = target ? PREVIEW : NONE
    if (!target) {
      target = itemTarget(input.pinnedItem)
      r = target ? PINNED : NONE
    }
    // A row held for the dwell is a new intent, not a step down, so it moves at once.
    if (r < rank && r !== PREVIEW && !left && !fresh) {
      if (leaveTimer === undefined) {
        leaveTimer = setTimeout(() => {
          leaveTimer = undefined
          left = true
          compute()
        }, leaveMs)
      }
      return
    }
    clearLeave()
    fresh = false
    emit(target, r)
  }

  return {
    update(next: FollowInput) {
      if (disposed) return
      if (next.hoveredDev !== input.hoveredDev || next.touch !== input.touch) {
        clearTimeout(dwellTimer)
        dwelled = null
        const dev = next.hoveredDev
        if (dev !== null && !next.touch) {
          // Only a card held for the dwell retires a request; passing over one (a sweep, or
          // the page scrolling under a still pointer after a jump) does not. A request made
          // after the pointer settled here is newer, so this dwell leaves it alone.
          const heldSeq = next.request?.seq
          dwellTimer = setTimeout(() => {
            if (input.request && input.request.seq === heldSeq && input.request.dev !== dev) staleSeq = input.request.seq
            dwelled = dev
            compute()
          }, dwellMs)
        }
      }
      if (next.previewItem !== input.previewItem) {
        clearTimeout(previewTimer)
        previewDwelled = null
        const key = next.previewItem
        if (key !== null) {
          previewTimer = setTimeout(() => {
            previewDwelled = key
            compute()
          }, dwellMs)
        }
      }
      if (next.hoveredDev !== input.hoveredDev) staleHover = -1
      // A new seq is never retired by the update that brings it, so a request wins over
      // a pin cleared in the same batch.
      const seq = next.request?.seq ?? -1
      const rowChanged = next.pinnedItem !== input.pinnedItem || next.previewItem !== input.previewItem
      // On desktop, keyboard focus moving to a different card is a newer intent too.
      const otherFocus = !next.touch && next.focusedDev !== input.focusedDev && next.focusedDev !== null &&
        next.focusedDev !== next.request?.dev
      if (seq === (input.request?.seq ?? -1) && (rowChanged || otherFocus)) staleSeq = seq
      if (next.pinnedItem !== input.pinnedItem) {
        staleHover = next.hoveredDev ?? -1
        fresh = true
      }
      input = next
      compute()
    },
    dispose() {
      disposed = true
      clearTimeout(dwellTimer)
      clearTimeout(previewTimer)
      clearTimeout(leaveTimer)
    },
  }
}

const DEG = Math.PI / 180
/** Past this much longitude, several points are shown on the overview instead. */
export const MAX_FRAME_LNG = 120

/**
 * Where to aim to show every point: their mean direction and the widest angle
 * (degrees) from it to any point. Null when they span over MAX_FRAME_LNG of longitude.
 */
export function frameOf(points: LatLng[]): { lat: number; lng: number; reach: number } | null {
  if (!points.length) return null
  const lngs = points.map((p) => ((p.lng % 360) + 360) % 360).sort((a, b) => a - b)
  let gap = 360 - lngs[lngs.length - 1] + lngs[0]
  for (let i = 1; i < lngs.length; i++) gap = Math.max(gap, lngs[i] - lngs[i - 1])
  if (360 - gap > MAX_FRAME_LNG) return null
  const vecs = points.map((p) => [Math.cos(p.lat * DEG) * Math.sin(p.lng * DEG), Math.sin(p.lat * DEG), Math.cos(p.lat * DEG) * Math.cos(p.lng * DEG)])
  const sum = vecs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0])
  const len = Math.hypot(sum[0], sum[1], sum[2]) || 1
  const c = sum.map((x) => x / len)
  const reach = Math.max(...vecs.map((v) => Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2])) / DEG))
  return { lat: Math.asin(c[1]) / DEG, lng: Math.atan2(c[0], c[2]) / DEG, reach }
}
