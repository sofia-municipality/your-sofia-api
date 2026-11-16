import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { missionProfileMe } from '@/endpoints/missions/missionProfileMe'
import { MissionProfiles } from '../MissionProfiles'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = MissionProfiles.access?.[operation]
  if (!rule) throw new Error(`MissionProfiles has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

describe('MissionProfiles collection access', () => {
  it('lets only city infrastructure admins create, edit or delete profiles', async () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      for (const role of CITY_INFRASTRUCTURE_ROLES) {
        expect(await checkAccess(operation, { id: 1, role })).toBe(true)
      }
      for (const role of ['user', 'wasteCollector']) {
        expect(await checkAccess(operation, { id: 5, role })).toBe(false)
      }
      expect(await checkAccess(operation, null)).toBe(false)
    }
  })

  it('lets city infrastructure admins read every profile', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('read', { id: 1, role })).toBe(true)
    }
  })

  it('limits citizens to their own profile', async () => {
    expect(await checkAccess('read', { id: 5, role: 'user' })).toEqual({ user: { equals: 5 } })
    expect(await checkAccess('read', null)).toBe(false)
  })

  it('registers the /me endpoint', () => {
    expect(MissionProfiles.endpoints).toContain(missionProfileMe)
  })
})
