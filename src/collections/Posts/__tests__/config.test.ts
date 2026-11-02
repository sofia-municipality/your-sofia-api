// @payloadcms/richtext-lexical and the SEO plugin ship ESM only — stub every export they provide
jest.mock(
  '@payloadcms/richtext-lexical',
  () =>
    new Proxy({ __esModule: true } as Record<string | symbol, unknown>, {
      get: (target, prop) => (prop in target ? target[prop] : () => ({})),
    })
)
jest.mock(
  '@payloadcms/plugin-seo/fields',
  () =>
    new Proxy({ __esModule: true } as Record<string | symbol, unknown>, {
      get: (target, prop) => (prop in target ? target[prop] : () => ({})),
    })
)

import type { AccessArgs, Field } from 'payload'
import { populateAuthors } from '../hooks/populateAuthors'
import { revalidateDelete, revalidatePost } from '../hooks/revalidatePost'
import { Posts } from '../index'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const NOW = '2026-03-15T10:30:00.000Z'

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = Posts.access?.[operation]
  if (!rule) throw new Error(`Posts has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const livePreviewUrl = (data: Record<string, unknown>) => {
  const url = Posts.admin?.livePreview?.url
  if (typeof url !== 'function') throw new Error('Posts has no live preview URL function')
  return url({ data, req: {} } as unknown as Parameters<typeof url>[0])
}

const previewUrl = (data: Record<string, unknown>) => {
  const preview = Posts.admin?.preview
  if (!preview) throw new Error('Posts has no preview function')
  return preview(data, { req: {} } as unknown as Parameters<typeof preview>[1])
}

// Finds a named field anywhere in the config, including inside tabs, groups and rows
const findField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field
    const nestedFields =
      field.type === 'tabs'
        ? field.tabs.flatMap((tab) => tab.fields)
        : 'fields' in field
          ? field.fields
          : []
    const match = findField(nestedFields, name)
    if (match) return match
  }
  return undefined
}

const runPublishedAtHook = (value: Date | undefined, status: 'draft' | 'published') => {
  const field = findField(Posts.fields, 'publishedAt')
  const hook = field && 'hooks' in field ? field.hooks?.beforeChange?.[0] : undefined
  if (!hook) throw new Error('Posts.publishedAt has no beforeChange hook')
  return hook({ value, siblingData: { _status: status } } as unknown as Parameters<typeof hook>[0])
}

describe('Posts collection config', () => {
  const originalPreviewSecret = process.env.PREVIEW_SECRET

  beforeEach(() => {
    process.env.PREVIEW_SECRET = 'secret'
  })

  afterEach(() => {
    jest.useRealTimers()
    if (originalPreviewSecret === undefined) {
      Reflect.deleteProperty(process.env, 'PREVIEW_SECRET')
    } else {
      process.env.PREVIEW_SECRET = originalPreviewSecret
    }
  })

  describe('access', () => {
    it('lets authenticated users create, edit and delete posts', async () => {
      for (const operation of ['create', 'update', 'delete'] as const) {
        expect(await checkAccess(operation, { id: 5, role: 'user' })).toBe(true)
        expect(await checkAccess(operation, null)).toBe(false)
      }
    })

    it('shows drafts to authenticated users and only published posts to everyone else', async () => {
      expect(await checkAccess('read', { id: 5, role: 'user' })).toBe(true)
      expect(await checkAccess('read', null)).toEqual({ _status: { equals: 'published' } })
    })
  })

  describe('preview URLs', () => {
    it('points live preview and the preview button at the post path', async () => {
      const expected =
        '/next/preview?slug=bike-lanes&collection=posts&path=%2Fposts%2Fbike-lanes&previewSecret=secret'
      expect(await livePreviewUrl({ slug: 'bike-lanes' })).toBe(expected)
      expect(await previewUrl({ slug: 'bike-lanes' })).toBe(expected)
    })

    it('falls back to an empty slug when the post has none yet', async () => {
      expect(await livePreviewUrl({})).toBe(
        '/next/preview?slug=&collection=posts&path=%2Fposts%2F&previewSecret=secret'
      )
    })
  })

  describe('publishedAt field hook', () => {
    it('defaults publishedAt to now when a post is published', async () => {
      jest.useFakeTimers({ now: new Date(NOW) })
      expect(await runPublishedAtHook(undefined, 'published')).toEqual(new Date(NOW))
    })

    it('keeps an explicit publish date and leaves drafts alone', async () => {
      const publishedAt = new Date('2026-01-01T08:00:00.000Z')
      expect(await runPublishedAtHook(publishedAt, 'published')).toBe(publishedAt)
      expect(await runPublishedAtHook(undefined, 'draft')).toBeUndefined()
    })
  })

  it('excludes the current post from its related posts', async () => {
    const field = findField(Posts.fields, 'relatedPosts')
    const filterOptions = field?.type === 'relationship' ? field.filterOptions : undefined
    if (typeof filterOptions !== 'function') throw new Error('relatedPosts has no filterOptions')

    expect(
      await filterOptions({ id: 7 } as unknown as Parameters<typeof filterOptions>[0])
    ).toEqual({ id: { not_in: [7] } })
  })

  it('never lets anyone edit the populated authors directly', async () => {
    const field = findField(Posts.fields, 'populatedAuthors')
    const update = field && 'access' in field ? field.access?.update : undefined
    if (!update) throw new Error('populatedAuthors has no update access rule')

    expect(
      await update({ req: { user: { id: 1, role: 'admin' } } } as unknown as Parameters<
        typeof update
      >[0])
    ).toBe(false)
  })

  it('registers the author and revalidation hooks', () => {
    expect(Posts.hooks).toEqual({
      afterChange: [revalidatePost],
      afterRead: [populateAuthors],
      afterDelete: [revalidateDelete],
    })
  })
})
