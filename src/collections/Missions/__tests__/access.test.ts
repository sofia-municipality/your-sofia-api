// payload uses ESM — mock it so Jest can import the hooks' APIError
jest.mock('payload', () => ({
  APIError: class APIError extends Error {},
}))

// Mock push notifications utility to avoid expo-server-sdk ESM issues
jest.mock('../../../utilities/pushNotifications', () => ({
  sendPushNotificationsToTokens: jest.fn(),
}))

import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { afterChangeCreditDarPoints } from '../hooks/afterChangeCreditDarPoints'
import { afterChangeNotifyCitizen } from '../hooks/afterChangeNotifyCitizen'
import { beforeChangeApplyStatusTimestamps } from '../hooks/beforeChangeApplyStatusTimestamps'
import { beforeChangeSetInspector } from '../hooks/beforeChangeSetInspector'
import { beforeValidateLockTasks } from '../hooks/beforeValidateLockTasks'
import { Missions } from '../index'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = Missions.access?.[operation]
  if (!rule) throw new Error(`Missions has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

describe('Missions collection access', () => {
  describe('access.read', () => {
    it('lets city infrastructure admins read every mission', async () => {
      for (const role of CITY_INFRASTRUCTURE_ROLES) {
        expect(await checkAccess('read', { id: 1, role })).toBe(true)
      }
    })

    it('limits anonymous visitors to open and completed missions', async () => {
      expect(await checkAccess('read', null)).toEqual({ status: { in: ['open', 'completed'] } })
    })

    it('lets citizens read public missions, missions awaiting review and their own', async () => {
      for (const role of ['user', 'wasteCollector']) {
        expect(await checkAccess('read', { id: 5, role })).toEqual({
          or: [
            { status: { in: ['open', 'completed', 'ready_for_review'] } },
            { citizen: { equals: 5 } },
          ],
        })
      }
    })
  })

  describe('access.create and access.update', () => {
    it('allows only city infrastructure admins', async () => {
      for (const operation of ['create', 'update'] as const) {
        for (const role of CITY_INFRASTRUCTURE_ROLES) {
          expect(await checkAccess(operation, { id: 1, role })).toBe(true)
        }
        for (const role of ['user', 'wasteCollector']) {
          expect(await checkAccess(operation, { id: 1, role })).toBe(false)
        }
        expect(await checkAccess(operation, null)).toBe(false)
      }
    })
  })

  describe('access.delete', () => {
    it('allows only admins', async () => {
      expect(await checkAccess('delete', { id: 1, role: 'admin' })).toBe(true)
      for (const role of [
        'inspector',
        'containerAdmin',
        'fountainAdmin',
        'wasteCollector',
        'user',
      ]) {
        expect(await checkAccess('delete', { id: 1, role })).toBe(false)
      }
      expect(await checkAccess('delete', null)).toBe(false)
    })
  })

  describe('hooks', () => {
    it('registers the mission hooks in order', () => {
      expect(Missions.hooks).toMatchObject({
        beforeValidate: [beforeValidateLockTasks],
        beforeChange: [beforeChangeSetInspector, beforeChangeApplyStatusTimestamps],
        afterChange: [afterChangeCreditDarPoints, afterChangeNotifyCitizen],
      })
    })
  })
})
