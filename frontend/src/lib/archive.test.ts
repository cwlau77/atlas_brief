import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { ARCHIVE_LIMIT, fileInto, groupThreads, hasHighAlert, PER_TOPIC_LIMIT, topicKey } from './archive'

const day = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString()
const brief = (id: string, area: string, d: number) => makeBriefing({ id, area, generatedAt: day(d) })
const ids = (list: { id: string }[]) => list.map((b) => b.id)

/** Files briefings oldest first, the way they arrive. */
const fileAll = (list: ReturnType<typeof brief>[], starred: string[] = []) =>
  list.reduce((saved, b) => fileInto(saved, b, starred), [] as ReturnType<typeof brief>[])

describe('topicKey', () => {
  it('ignores case and extra whitespace', () => expect(topicKey('  Red Sea   Shipping ')).toBe('red sea shipping'))
})

describe('fileInto', () => {
  const four = [1, 2, 3, 4].map((d) => brief(`r${d}`, 'Red Sea shipping', d))

  it('keeps history per topic up to the cap, newest first', () => {
    expect(PER_TOPIC_LIMIT).toBe(4)
    expect(ids(fileAll(four))).toEqual(['r4', 'r3', 'r2', 'r1'])
  })

  it('drops the oldest of the topic when a fifth arrives', () => {
    expect(ids(fileInto(fileAll(four), brief('r5', 'Red Sea shipping', 5), []))).toEqual(['r5', 'r4', 'r3', 'r2'])
  })

  it('drops the oldest unstarred one before any starred one', () => {
    const next = fileInto(fileAll(four), brief('r5', 'Red Sea shipping', 5), ['r1', 'r2'])
    expect(ids(next)).toEqual(['r5', 'r4', 'r2', 'r1'])
  })

  it('never drops a starred briefing: when every older one is starred, the new one is not archived', () => {
    const next = fileInto(fileAll(four), brief('r5', 'Red Sea shipping', 5), ['r1', 'r2', 'r3', 'r4'])
    expect(ids(next)).toEqual(['r4', 'r3', 'r2', 'r1'])
  })

  it('counts spellings that differ only by case and spacing as one topic', () => {
    const mixed = [brief('a', 'Red Sea shipping', 1), brief('b', 'red sea  shipping', 2), brief('c', 'RED SEA SHIPPING', 3), brief('d', 'Red Sea shipping', 4)]
    expect(ids(fileInto(fileAll(mixed), brief('e', 'red sea shipping', 5), []))).toEqual(['e', 'd', 'c', 'b'])
  })

  it('caps the whole archive, dropping the oldest unstarred overall', () => {
    expect(ARCHIVE_LIMIT).toBe(24)
    const many = Array.from({ length: 24 }, (_, i) => brief(`t${i}`, `topic ${i}`, i + 1))
    const next = fileInto(fileAll(many), brief('new', 'topic new', 30), ['t0'])
    expect(next).toHaveLength(24)
    expect(ids(next)).toContain('t0')
    expect(ids(next)).not.toContain('t1')
    expect(ids(next)[0]).toBe('new')
  })

  it('keeps a fully starred archive intact at the total cap', () => {
    const many = Array.from({ length: 24 }, (_, i) => brief(`t${i}`, `topic ${i}`, i + 1))
    const next = fileInto(fileAll(many), brief('new', 'topic new', 30), many.map((b) => b.id))
    expect(ids(next)).not.toContain('new')
    expect(next).toHaveLength(24)
  })
})

describe('groupThreads', () => {
  it('groups by topic, oldest to newest within, newest thread first', () => {
    const saved = fileAll([brief('a1', 'Chip export controls', 1), brief('r1', 'Red Sea shipping', 2), brief('a2', 'chip export  controls', 3), brief('r2', 'Red Sea shipping', 5)])
    const threads = groupThreads(saved)
    expect(threads.map((t) => [t.key, t.area, ids(t.briefings)])).toEqual([
      ['red sea shipping', 'Red Sea shipping', ['r1', 'r2']],
      ['chip export controls', 'chip export  controls', ['a1', 'a2']],
    ])
  })
})

describe('hasHighAlert', () => {
  it('is true for a critical or high alert and false without', () => {
    expect(hasHighAlert(makeBriefing())).toBe(true)
    expect(hasHighAlert(makeBriefing({ alerts: [] }))).toBe(false)
  })
})
