import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { buildThreads, threadPath } from './threads'
import { linkBriefing, sortDevelopments } from './timeline'

const threadsFor = (b = makeBriefing()) => buildThreads(linkBriefing(b), sortDevelopments(b.keyDevelopments))

describe('buildThreads', () => {
  it('draws nothing when every item links a single development', () => {
    expect(threadsFor()).toEqual([])
  })

  it('ties two developments sharing a tension, earlier one first', () => {
    const b = makeBriefing()
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    // dev 0 (02:10) is earlier than dev 1 (05:45) in the fixture
    expect(threadsFor(b)).toEqual([{ key: 'tension-0:0-1', linkKey: 'tension-0', from: 0, to: 1, lane: 0 }])
  })

  it('chains an item linked to three developments in timeline order', () => {
    const b = makeBriefing()
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['Egypt', 'Red Sea'] }
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    const ts = threadsFor(b).filter((t) => t.linkKey === 'tension-0')
    const order = sortDevelopments(b.keyDevelopments).map((e) => e.index)
    expect(ts.map((t) => [t.from, t.to])).toEqual([[order[0], order[1]], [order[1], order[2]]])
  })

  it('gives parallel threads between the same pair separate lanes', () => {
    const b = makeBriefing()
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    b.contradictions[0] = { ...b.contradictions[0], topic: 'Red Sea damage reports' }
    expect(threadsFor(b).map((t) => [t.linkKey, t.lane])).toEqual([['tension-0', 0], ['contradiction-0', 1]])
  })
})

describe('threadPath', () => {
  it('is deterministic per seed and runs from y1 to y2 at x', () => {
    const a = threadPath(100, 10, 200, 0, 'a')
    expect(threadPath(100, 10, 200, 0, 'a')).toBe(a)
    expect(threadPath(100, 10, 200, 0, 'b')).not.toBe(a)
    expect(a.startsWith('M100 10')).toBe(true)
    expect(a.endsWith('100 200')).toBe(true)
  })

  it('bows left of x, further on outer lanes', () => {
    const minX = (d: string) => Math.min(...d.replace(/[MC,]/g, ' ').trim().split(/\s+/).map(Number).filter((_, i) => i % 2 === 0))
    expect(minX(threadPath(100, 10, 200, 0, 'a'))).toBeLessThan(100)
    expect(minX(threadPath(100, 10, 200, 2, 'a'))).toBeLessThan(minX(threadPath(100, 10, 200, 0, 'a')))
  })
})
