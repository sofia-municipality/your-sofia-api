import { formatAuthors } from '../formatAuthors'

type Authors = Parameters<typeof formatAuthors>[0]

const authors = (...names: Array<string | null>): Authors =>
  names.map((name, i) => ({ id: String(i + 1), name }))

describe('formatAuthors (unit)', () => {
  it('returns an empty string when there are no named authors', () => {
    expect(formatAuthors([])).toBe('')
    expect(formatAuthors(authors(null, ''))).toBe('')
  })

  it('returns a single name as is', () => {
    expect(formatAuthors(authors('Иван'))).toBe('Иван')
  })

  it('joins two names with "and"', () => {
    expect(formatAuthors(authors('Иван', 'Мария'))).toBe('Иван and Мария')
  })

  it('joins three or more names with commas and a final "and"', () => {
    expect(formatAuthors(authors('Иван', 'Мария', 'Георги'))).toBe('Иван, Мария and Георги')
  })

  it('skips authors without a name', () => {
    expect(formatAuthors(authors('Иван', null, 'Мария'))).toBe('Иван and Мария')
  })
})
