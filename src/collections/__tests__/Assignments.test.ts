import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { Assignments } from '../Assignments'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null
type AssignmentData = { status?: string; completedAt?: string }

const NOW = '2026-03-15T10:30:00.000Z'

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = Assignments.access?.[operation]
  if (!rule) throw new Error(`Assignments has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const runBeforeChange = (data: AssignmentData, operation: 'create' | 'update'): AssignmentData => {
  const hook = Assignments.hooks?.beforeChange?.[0]
  if (!hook) throw new Error('Assignments has no beforeChange hook')
  return hook({ data, operation } as unknown as Parameters<typeof hook>[0])
}

describe('Assignments collection access', () => {
  it('lets city infrastructure admins and waste collectors read assignments', async () => {
    for (const role of [...CITY_INFRASTRUCTURE_ROLES, 'wasteCollector']) {
      expect(await checkAccess('read', { id: 1, role })).toBe(true)
    }
    expect(await checkAccess('read', { id: 5, role: 'user' })).toBe(false)
    expect(await checkAccess('read', null)).toBe(false)
  })

  it('lets only city infrastructure admins create, edit or delete assignments', async () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      for (const role of CITY_INFRASTRUCTURE_ROLES) {
        expect(await checkAccess(operation, { id: 1, role })).toBe(true)
      }
      for (const role of ['wasteCollector', 'user']) {
        expect(await checkAccess(operation, { id: 5, role })).toBe(false)
      }
      expect(await checkAccess(operation, null)).toBe(false)
    }
  })
})

describe('Assignments beforeChange hook', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(NOW) })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sets completedAt when an assignment is completed', () => {
    expect(runBeforeChange({ status: 'completed' }, 'update')).toEqual({
      status: 'completed',
      completedAt: NOW,
    })
  })

  it('keeps an existing completedAt', () => {
    const data = { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' }
    expect(runBeforeChange(data, 'update')).toEqual(data)
  })

  it('does not set completedAt on create or for other statuses', () => {
    expect(runBeforeChange({ status: 'completed' }, 'create')).toEqual({ status: 'completed' })
    expect(runBeforeChange({ status: 'in-progress' }, 'update')).toEqual({ status: 'in-progress' })
  })
})
