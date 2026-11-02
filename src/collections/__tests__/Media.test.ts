// @payloadcms/richtext-lexical ships ESM only — stub every export the collection uses
jest.mock(
  '@payloadcms/richtext-lexical',
  () =>
    new Proxy({ __esModule: true } as Record<string | symbol, unknown>, {
      get: (target, prop) => (prop in target ? target[prop] : () => ({})),
    })
)

import path from 'path'
import type { AccessArgs } from 'payload'
import { Media } from '../Media'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser, data?: Record<string, unknown>) => {
  const rule = Media.access?.[operation]
  if (!rule) throw new Error(`Media has no ${operation} access rule`)
  return rule({ req: { user }, data } as unknown as AccessArgs)
}

describe('Media collection access', () => {
  it('lets authenticated users upload', async () => {
    expect(await checkAccess('create', { id: 5, role: 'user' }, {})).toBe(true)
  })

  it('lets anonymous devices upload only with a reporter id', async () => {
    expect(await checkAccess('create', null, { reporterUniqueId: 'R1' })).toBe(true)
    expect(await checkAccess('create', null, { reporterUniqueId: '' })).toBe(false)
    expect(await checkAccess('create', null, {})).toBe(false)
    expect(await checkAccess('create', null)).toBe(false)
  })

  it('lets anyone read media', async () => {
    expect(await checkAccess('read', null)).toBe(true)
  })

  it('lets only admins edit or delete media', async () => {
    for (const operation of ['update', 'delete'] as const) {
      expect(await checkAccess(operation, { id: 1, role: 'admin' })).toBe(true)
      expect(await checkAccess(operation, { id: 5, role: 'user' })).toBe(false)
      expect(await checkAccess(operation, null)).toBe(false)
    }
  })
})

describe('Media uploads', () => {
  it('stores files in public/media', () => {
    const upload = Media.upload
    expect(typeof upload === 'object' ? upload.staticDir : undefined).toBe(
      path.resolve(process.cwd(), 'public/media')
    )
  })
})
