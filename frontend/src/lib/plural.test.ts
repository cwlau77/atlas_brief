import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('keeps the singular for one', () => expect(plural(1, 'article')).toBe('1 article'))
  it('adds s for many and for zero', () => {
    expect(plural(16, 'article')).toBe('16 articles')
    expect(plural(0, 'article')).toBe('0 articles')
  })
  it('accepts an irregular plural', () => expect(plural(2, 'story', 'stories')).toBe('2 stories'))
})
