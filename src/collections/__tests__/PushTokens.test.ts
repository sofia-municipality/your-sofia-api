import type { AccessArgs } from 'payload'
import { PushTokens } from '../PushTokens'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = PushTokens.access?.[operation]
  if (!rule) throw new Error(`PushTokens has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const checkAdminPanelAccess = (user: MockUser) => {
  const rule = PushTokens.access?.admin
  if (!rule) throw new Error('PushTokens has no admin access rule')
  return rule({ req: { user } } as unknown as Parameters<typeof rule>[0])
}

describe('PushTokens collection access', () => {
  it('lets anonymous devices register a push token', async () => {
    expect(await checkAccess('create', null)).toBe(true)
  })

  it('denies anonymous requests to read, edit or delete push tokens', async () => {
    for (const operation of ['read', 'update', 'delete'] as const) {
      expect(await checkAccess(operation, null)).toBe(false)
    }
  })

  it('shows the collection in the admin panel to admins only', async () => {
    expect(await checkAdminPanelAccess({ id: 1, role: 'admin' })).toBe(true)
    for (const role of ['inspector', 'containerAdmin', 'user']) {
      expect(await checkAdminPanelAccess({ id: 1, role })).toBe(false)
    }
  })
})
