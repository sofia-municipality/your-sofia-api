import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { DarPointsTransactions } from '../DarPointsTransactions'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = DarPointsTransactions.access?.[operation]
  if (!rule) throw new Error(`DarPointsTransactions has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

describe('DarPointsTransactions collection access', () => {
  it('never allows creating or editing ledger entries through the API', async () => {
    for (const operation of ['create', 'update'] as const) {
      for (const user of [null, { id: 5, role: 'user' }, { id: 1, role: 'admin' }]) {
        expect(await checkAccess(operation, user)).toBe(false)
      }
    }
  })

  it('lets city infrastructure admins read every ledger entry', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('read', { id: 1, role })).toBe(true)
    }
  })

  it('limits citizens to their own ledger entries', async () => {
    for (const role of ['user', 'wasteCollector']) {
      expect(await checkAccess('read', { id: 5, role })).toEqual({ user: { equals: 5 } })
    }
    expect(await checkAccess('read', null)).toBe(false)
  })

  it('lets only city infrastructure admins delete ledger entries', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('delete', { id: 1, role })).toBe(true)
    }
    expect(await checkAccess('delete', { id: 5, role: 'user' })).toBe(false)
    expect(await checkAccess('delete', null)).toBe(false)
  })
})
