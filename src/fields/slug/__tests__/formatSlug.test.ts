import { formatSlug, formatSlugHook } from '../formatSlug'

type HookArgs = {
  data?: Record<string, unknown>
  operation?: 'create' | 'update'
  value?: unknown
}

const runHook = (fallback: string, args: HookArgs) =>
  formatSlugHook(fallback)(args as unknown as Parameters<ReturnType<typeof formatSlugHook>>[0])

describe('formatSlug (unit)', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(formatSlug('Hello World')).toBe('hello-world')
  })

  it('strips punctuation but keeps dashes, underscores and digits', () => {
    expect(formatSlug('Sofia 2026: what_s new?!')).toBe('sofia-2026-what_s-new')
  })

  // BUG (bugs.md #6): `[^\w-]` removes every non-ASCII letter, so Bulgarian titles become "--".
  // Either a transliterated or a Cyrillic slug is fine, as long as the words survive.
  it.failing('keeps the words of a Bulgarian title', () => {
    expect(formatSlug('Новина за София')).toMatch(/^[^-]+-[^-]+-[^-]+$/)
  })
})

describe('formatSlugHook (unit)', () => {
  it('formats an explicitly provided slug', () => {
    expect(runHook('title', { operation: 'update', value: 'My Custom Slug', data: {} })).toBe(
      'my-custom-slug'
    )
  })

  it('derives the slug from the fallback field on create', () => {
    expect(runHook('title', { operation: 'create', data: { title: 'Fresh Post' } })).toBe(
      'fresh-post'
    )
  })

  it('derives the slug from the fallback field on update when the doc has no slug yet', () => {
    expect(runHook('title', { operation: 'update', data: { title: 'Late Slug' } })).toBe(
      'late-slug'
    )
  })

  it('keeps the existing value on update when the doc already has a slug', () => {
    expect(
      runHook('title', {
        operation: 'update',
        data: { title: 'Renamed', slug: 'original' },
        value: undefined,
      })
    ).toBeUndefined()
  })

  it('returns the value untouched when the fallback field is not a string', () => {
    expect(runHook('title', { operation: 'create', data: { title: 42 }, value: null })).toBeNull()
    expect(runHook('title', { operation: 'create', value: null })).toBeNull()
  })
})
