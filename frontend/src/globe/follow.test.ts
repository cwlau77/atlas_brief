import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFollow, frameOf, type FollowInput, type FollowTarget } from './follow'

const PLACES: Record<number, { lat: number; lng: number; markerKey: string }> = {
  0: { lat: 15, lng: 44, markerKey: 'region:Yemen' },
  1: { lat: 1.3, lng: 103.8, markerKey: 'city:Singapore' },
  2: { lat: 51.9, lng: 4.4, markerKey: 'city:Rotterdam' },
}
const ITEMS: Record<string, number[]> = { 'tension-0': [0, 2], 'tension-1': [1], empty: [] }

const IDLE: FollowInput = {
  hoveredDev: null, focusedDev: null, tappedDev: null, previewItem: null, pinnedItem: null, carouselOpen: false, touch: false,
}

function setup() {
  const targets: FollowTarget[] = []
  const follow = createFollow({
    resolve: (dev) => PLACES[dev] ?? null,
    itemDevs: (key) => ITEMS[key] ?? [],
    onTarget: (t) => targets.push(t),
  })
  let input = IDLE
  const set = (over: Partial<FollowInput>) => {
    input = { ...input, ...over }
    follow.update(input)
  }
  return { targets, follow, set }
}

const one = (dev: number): FollowTarget => ({ points: [{ lat: PLACES[dev].lat, lng: PLACES[dev].lng }], markerKey: PLACES[dev].markerKey })

describe('createFollow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sweep under 250ms never emits a target', () => {
    const { targets, set } = setup()
    set({ hoveredDev: 0 })
    vi.advanceTimersByTime(120)
    set({ hoveredDev: 1 })
    vi.advanceTimersByTime(120)
    set({ hoveredDev: 2 })
    vi.advanceTimersByTime(120)
    set({ hoveredDev: null })
    vi.advanceTimersByTime(2000)
    expect(targets).toEqual([])
  })

  it('dwell 250ms emits that development', () => {
    const { targets, set } = setup()
    set({ hoveredDev: 1 })
    vi.advanceTimersByTime(249)
    expect(targets).toEqual([])
    vi.advanceTimersByTime(1)
    expect(targets).toEqual([one(1)])
  })

  it('moving card to card glides without null in between', () => {
    const { targets, set } = setup()
    set({ hoveredDev: 0 })
    vi.advanceTimersByTime(300)
    // The pointer crosses the gap between cards, then rests on the next one.
    set({ hoveredDev: null })
    vi.advanceTimersByTime(100)
    set({ hoveredDev: 1 })
    vi.advanceTimersByTime(300)
    expect(targets).toEqual([one(0), one(1)])
  })

  it('leaving emits null after 400ms', () => {
    const { targets, set } = setup()
    set({ hoveredDev: 0 })
    vi.advanceTimersByTime(300)
    set({ hoveredDev: null })
    vi.advanceTimersByTime(399)
    expect(targets).toEqual([one(0)])
    vi.advanceTimersByTime(1)
    expect(targets).toEqual([one(0), null])
  })

  it('pinned item frames its developments when nothing hovered', () => {
    const { targets, set } = setup()
    set({ pinnedItem: 'tension-0' })
    expect(targets).toEqual([{ points: [{ lat: 15, lng: 44 }, { lat: 51.9, lng: 4.4 }], markerKey: null }])
    // A hovered card wins over the pin, and leaving returns to the pin rather than the overview.
    set({ hoveredDev: 1 })
    vi.advanceTimersByTime(250)
    expect(targets.at(-1)).toEqual(one(1))
    set({ hoveredDev: null })
    vi.advanceTimersByTime(400)
    expect(targets.at(-1)).toEqual(targets[0])
  })

  it('previewed item wins over the pinned one', () => {
    const { targets, set } = setup()
    set({ pinnedItem: 'tension-0', previewItem: 'tension-1' })
    vi.advanceTimersByTime(250)
    // A one-development item marks that development's point.
    expect(targets.at(-1)).toEqual(one(1))
  })

  it('row preview sweep under 250ms never emits', () => {
    const { targets, set } = setup()
    set({ previewItem: 'tension-0' })
    vi.advanceTimersByTime(120)
    set({ previewItem: 'tension-1' })
    vi.advanceTimersByTime(120)
    set({ previewItem: null })
    vi.advanceTimersByTime(2000)
    expect(targets).toEqual([])
  })

  it('row preview held 250ms frames its developments', () => {
    const { targets, set } = setup()
    set({ previewItem: 'tension-0' })
    vi.advanceTimersByTime(249)
    expect(targets).toEqual([])
    vi.advanceTimersByTime(1)
    expect(targets).toEqual([{ points: [{ lat: 15, lng: 44 }, { lat: 51.9, lng: 4.4 }], markerKey: null }])
  })

  it('pinning from a hovered card frames the pinned row at once', () => {
    // Clicking a card's connection tag pins a row while the pointer is still on the card.
    const { targets, set } = setup()
    set({ hoveredDev: 1 })
    vi.advanceTimersByTime(300)
    set({ pinnedItem: 'tension-0' })
    expect(targets.at(-1)).toEqual({ points: [{ lat: 15, lng: 44 }, { lat: 51.9, lng: 4.4 }], markerKey: null })
    // The same card does not pull the globe back; a new card does.
    vi.advanceTimersByTime(1000)
    expect(targets).toHaveLength(2)
    set({ hoveredDev: 2 })
    vi.advanceTimersByTime(250)
    expect(targets.at(-1)).toEqual(one(2))
  })

  it('touch tap then pin frames the pinned row', () => {
    const { targets, set } = setup()
    set({ touch: true, tappedDev: 1 })
    expect(targets).toEqual([one(1)])
    set({ pinnedItem: 'tension-0' })
    expect(targets.at(-1)).toEqual({ points: [{ lat: 15, lng: 44 }, { lat: 51.9, lng: 4.4 }], markerKey: null })
    // A fresh tap wins again.
    set({ tappedDev: 2 })
    expect(targets.at(-1)).toEqual(one(2))
  })

  it('carousel open suppresses targets', () => {
    const { targets, set } = setup()
    set({ carouselOpen: true, hoveredDev: 0 })
    vi.advanceTimersByTime(1000)
    set({ focusedDev: 1, pinnedItem: 'tension-0' })
    vi.advanceTimersByTime(1000)
    expect(targets).toEqual([])
    // Closing resumes following.
    set({ carouselOpen: false })
    expect(targets).toEqual([one(1)])
  })

  it('unresolvable development leaves target unchanged', () => {
    const { targets, set } = setup()
    set({ hoveredDev: 0 })
    vi.advanceTimersByTime(300)
    set({ hoveredDev: 9 })
    vi.advanceTimersByTime(2000)
    expect(targets).toEqual([one(0)])
  })

  it('an item with no resolvable developments is skipped', () => {
    const { targets, set } = setup()
    set({ pinnedItem: 'empty' })
    vi.advanceTimersByTime(1000)
    expect(targets).toEqual([])
  })

  it('touch mode ignores hover and follows tap', () => {
    const { targets, set } = setup()
    set({ touch: true, hoveredDev: 0 })
    vi.advanceTimersByTime(1000)
    expect(targets).toEqual([])
    set({ tappedDev: 2 })
    expect(targets).toEqual([one(2)])
  })

  it('focus emits immediately', () => {
    const { targets, set } = setup()
    set({ focusedDev: 2 })
    expect(targets).toEqual([one(2)])
  })

  it('dispose cancels pending timers', () => {
    const { targets, set, follow } = setup()
    set({ hoveredDev: 0 })
    follow.dispose()
    vi.advanceTimersByTime(1000)
    expect(targets).toEqual([])
  })
})

describe('frameOf', () => {
  it('centres between points and reports their angular reach', () => {
    const f = frameOf([{ lat: 0, lng: -10 }, { lat: 0, lng: 10 }])!
    expect(f.lat).toBeCloseTo(0)
    expect(f.lng).toBeCloseTo(0)
    expect(f.reach).toBeCloseTo(10)
  })
  it('wraps across the antimeridian', () => {
    const f = frameOf([{ lat: 0, lng: 170 }, { lat: 0, lng: -170 }])!
    expect(Math.abs(f.lng)).toBeCloseTo(180)
    expect(f.reach).toBeCloseTo(10)
  })
  it('falls back to the overview past 120 degrees of longitude', () => {
    expect(frameOf([{ lat: 0, lng: -70 }, { lat: 0, lng: 60 }])).toBeNull()
    expect(frameOf([{ lat: 10, lng: 0 }, { lat: 0, lng: 100 }])).not.toBeNull()
  })
})
