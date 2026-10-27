import { describe, expect, it } from 'vitest'
import { figureGroups, parseFigure } from './keyFigures'
import type { FigureKind, ViewKeyFigure } from './normalize'

const fig = (figure: string, kind: FigureKind | null, outlet = 'cepr.org', published_at: string | null = '2026-10-26T00:00:00Z'): ViewKeyFigure => ({
  figure, label: 'what it measures', kind, period: null, source: { outlet, url: `https://${outlet}/${figure}`, published_at },
})

describe('parseFigure', () => {
  it.each([
    ['34 million people', 34e6, 'count:people', false], ['19.5 million', 19.5e6, 'count:', false],
    ['Nearly 14 million', 14e6, 'count:', false], ['$5 billion', 5e9, 'money:$', false],
    ['US$2.3bn', 2.3e9, 'money:US$', false], ['around 8%', 8, 'percent', false],
    ['below 10%', 10, 'percent', true], ['at least 43 hospitals', 43, 'count:hospitals', true],
    ['1,200 troops', 1200, 'count:troops', false], ['12 per cent', 12, 'percent', false],
    ['€3bn', 3e9, 'money:€', false], ['EUR 40 million', 40e6, 'money:EUR', false],
  ])('parseFigure(%s)', (text, value, unit, bound) => {
    const p = parseFigure(text)
    expect(p?.value).toBeCloseTo(value as number)
    expect(p && { unit: p.unit, bound: p.bound }).toEqual({ unit, bound })
  })

  it.each(['10–15%', '10-15%', '3/4', 'two dozen', '5 to 7 million', '-3%'])('parseFigure(%s) is null', (text) => {
    expect(parseFigure(text)).toBeNull()
  })
})

describe('figureGroups', () => {
  it('charts people from three outlets on one scale from zero', () => {
    const g = figureGroups([
      fig('34 million people', 'people', 'news.un.org', '2026-10-21T12:08:05Z'),
      fig('19.5 million', 'people', 'allAfrica.com', '2026-10-26T04:47:44Z'),
      fig('Nearly 14 million', 'people', 'elon.edu', '2026-10-21T12:05:57Z'),
    ], 'UTC')
    expect(g.chart?.scale).toBe('bars')
    const widths = g.chart!.rows.map((r) => r.width!)
    expect(widths[0]).toBe(100)
    expect(widths[1]).toBeCloseTo(57.35, 1)
    expect(widths[2]).toBeCloseTo(41.18, 1)
    expect(g.chart!.caption).toBe('People · one scale from zero · 3 outlets, 21–26 Oct')
    expect(g.plain).toEqual([])
  })

  it('draws shares as meters and leaves a bound uncharted', () => {
    const g = figureGroups([fig('around 8%', 'share'), fig('roughly 20%', 'share'), fig('below 10%', 'share')], 'UTC')
    expect(g.chart?.scale).toBe('meter')
    expect(g.chart!.rows.map((r) => r.width)).toEqual([8, 20, null])
    expect(g.chart!.rows.map((r) => r.note)).toEqual([null, null, 'a limit, not charted'])
    expect(g.chart!.caption).toBe('Shares of 100% · 1 outlet, 26 Oct')
  })

  it.each([
    ['money in two currencies', [fig('$5 billion', 'money'), fig('€3bn', 'money')]],
    ['counts of different things', [fig('43 hospitals', 'count'), fig('8 ships', 'count')]],
    ['changes', [fig('4.5%', 'change'), fig('3%', 'change')]],
    ['other', [fig('2.5', 'other'), fig('3', 'other')]],
    ['a share over 100', [fig('120%', 'share'), fig('20%', 'share')]],
    ['a single figure', [fig('$5 billion', 'money')]],
    ['an unknown kind', [fig('5', null), fig('6', null)]],
  ])('no chart for %s', (_name, figures) => {
    const g = figureGroups(figures, 'UTC')
    expect(g.chart).toBeNull()
    expect(g.plain).toEqual(figures)
  })

  it('charts the comparable pair and lists the odd one out', () => {
    const money = fig('$5 billion', 'money')
    const g = figureGroups([fig('34 million people', 'people'), money, fig('19.5 million', 'people')], 'UTC')
    expect(g.chart!.rows.map((r) => r.figure.figure)).toEqual(['34 million people', '19.5 million'])
    expect(g.plain).toEqual([money])
  })

  it('leaves undated figures out of the date span', () => {
    const g = figureGroups([fig('34 million', 'people', 'a.org', null), fig('19.5 million', 'people', 'b.org')], 'UTC')
    expect(g.chart!.caption).toBe('People · one scale from zero · 2 outlets, 26 Oct')
  })

  it('spans months in full', () => {
    const g = figureGroups([
      fig('34 million', 'people', 'a.org', '2026-09-30T00:00:00Z'), fig('19.5 million', 'people', 'b.org', '2026-10-02T00:00:00Z'),
    ], 'UTC')
    expect(g.chart!.caption).toBe('People · one scale from zero · 2 outlets, 30 Sep–2 Oct')
  })
})
