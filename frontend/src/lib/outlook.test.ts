import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { ViewOutlook } from './normalize'
import { BASIS_LABELS, buildOutlook } from './outlook'
import { sortNewestFirst } from './timeline'

const item = (statement: string, basis: ViewOutlook['basis'], relatedDevelopments: number[] | null): ViewOutlook =>
  ({ statement, basis, quote: basis === 'reported' ? 'q q q q' : null, sources: [], watchFor: null, relatedDevelopments })

const build = (trends: ViewOutlook[], implications: ViewOutlook[] = []) => {
  const b = makeBriefing({ trends, implications })
  return buildOutlook(b, sortNewestFirst(b.keyDevelopments))
}

describe('buildOutlook', () => {
  it('labels the two kinds', () => {
    expect(BASIS_LABELS).toEqual({ reported: 'Reported', assessment: 'Atlas assessment' })
  })

  it('puts Reported first and keeps each saved index in the key', () => {
    const { trends } = build([item('A', 'assessment', [0]), item('R', 'reported', [1])])
    expect(trends.map((r) => [r.key, r.statement])).toEqual([['trend-1', 'R'], ['trend-0', 'A']])
  })

  it('lists linked developments in timeline order', () => {
    const b = makeBriefing({ trends: [item('A', 'assessment', [0, 1, 2])] })
    const order = sortNewestFirst(b.keyDevelopments)
    const { trends } = buildOutlook(b, order)
    expect(trends[0].linked.map((l) => l.dev)).toEqual(order.map((e) => e.index))
    expect(trends[0].linked[0]).toEqual({ dev: order[0].index, title: order[0].dev.title, timestamp: order[0].dev.timestamp })
  })

  it('hides an unlinked assessment and keeps an unlinked Reported item', () => {
    const { trends, implications } = build([item('A', 'assessment', []), item('B', 'assessment', null)], [item('R', 'reported', null)])
    expect(trends).toEqual([])
    expect(implications.map((r) => [r.key, r.linked])).toEqual([['implication-0', []]])
  })

  it('ignores development indexes out of range', () => {
    const { trends } = build([item('A', 'assessment', [0, 99, -1])])
    expect(trends[0].devs).toEqual([0])
  })

  it('takes the first source and watchFor through', () => {
    const src = { outlet: 'Reuters', url: 'https://r.eu/x', published_at: null }
    const { implications } = build([], [{ ...item('R', 'reported', [0]), sources: [src], watchFor: 'W' }])
    expect(implications[0]).toMatchObject({ kind: 'implication', basis: 'reported', source: src, watchFor: 'W', quote: 'q q q q' })
  })
})
