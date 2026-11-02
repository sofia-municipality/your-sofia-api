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

import type { AccessArgs } from 'payload'
import { populatePublishedAt } from '../../../hooks/populatePublishedAt'
import { revalidateDelete, revalidatePage } from '../hooks/revalidatePage'
import { Pages } from '../index'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = Pages.access?.[operation]
  if (!rule) throw new Error(`Pages has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const checkAdminPanelAccess = (user: MockUser) => {
  const rule = Pages.access?.admin
  if (!rule) throw new Error('Pages has no admin access rule')
  return rule({ req: { user } } as unknown as Parameters<typeof rule>[0])
}

const livePreviewUrl = (data: Record<string, unknown>) => {
  const url = Pages.admin?.livePreview?.url
  if (typeof url !== 'function') throw new Error('Pages has no live preview URL function')
  return url({ data, req: {} } as unknown as Parameters<typeof url>[0])
}

const previewUrl = (data: Record<string, unknown>) => {
  const preview = Pages.admin?.preview
  if (!preview) throw new Error('Pages has no preview function')
  return preview(data, { req: {} } as unknown as Parameters<typeof preview>[1])
}

describe('Pages collection config', () => {
  const originalPreviewSecret = process.env.PREVIEW_SECRET

  beforeEach(() => {
    process.env.PREVIEW_SECRET = 'secret'
  })

  afterEach(() => {
    if (originalPreviewSecret === undefined) {
      Reflect.deleteProperty(process.env, 'PREVIEW_SECRET')
    } else {
      process.env.PREVIEW_SECRET = originalPreviewSecret
    }
  })

  describe('access', () => {
    it('lets authenticated users create, edit and delete pages', async () => {
      for (const operation of ['create', 'update', 'delete'] as const) {
        expect(await checkAccess(operation, { id: 5, role: 'user' })).toBe(true)
        expect(await checkAccess(operation, null)).toBe(false)
      }
    })

    it('shows drafts to authenticated users and only published pages to everyone else', async () => {
      expect(await checkAccess('read', { id: 5, role: 'user' })).toBe(true)
      expect(await checkAccess('read', null)).toEqual({ _status: { equals: 'published' } })
    })

    it('shows the collection in the admin panel to admins only', async () => {
      expect(await checkAdminPanelAccess({ id: 1, role: 'admin' })).toBe(true)
      expect(await checkAdminPanelAccess({ id: 2, role: 'inspector' })).toBe(false)
    })
  })

  describe('preview URLs', () => {
    it('points live preview at the page path', async () => {
      expect(await livePreviewUrl({ slug: 'about' })).toBe(
        '/next/preview?slug=about&collection=pages&path=%2Fabout&previewSecret=secret'
      )
    })

    it('points the preview button at the page path', async () => {
      expect(await previewUrl({ slug: 'about' })).toBe(
        '/next/preview?slug=about&collection=pages&path=%2Fabout&previewSecret=secret'
      )
    })

    it('falls back to an empty slug when the page has none yet', async () => {
      const expected = '/next/preview?slug=&collection=pages&path=%2F&previewSecret=secret'
      expect(await livePreviewUrl({})).toBe(expected)
      expect(await previewUrl({ slug: 42 })).toBe(expected)
    })
  })

  it('registers the publish and revalidation hooks', () => {
    expect(Pages.hooks).toEqual({
      afterChange: [revalidatePage],
      beforeChange: [populatePublishedAt],
      afterDelete: [revalidateDelete],
    })
  })
})
