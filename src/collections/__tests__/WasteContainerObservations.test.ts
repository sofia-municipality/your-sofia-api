import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { WasteContainerObservations } from '../WasteContainerObservations'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null
type ObservationData = { container?: number; cleanedBy?: number; cleanedAt?: string }

const NOW = '2026-03-15T10:30:00.000Z'

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = WasteContainerObservations.access?.[operation]
  if (!rule) throw new Error(`WasteContainerObservations has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const runBeforeChange = (data: ObservationData, user: MockUser = { id: 7, role: 'inspector' }) => {
  const hook = WasteContainerObservations.hooks?.beforeChange?.[0]
  if (!hook) throw new Error('WasteContainerObservations has no beforeChange hook')
  const result: ObservationData = hook({ data, req: { user } } as unknown as Parameters<
    typeof hook
  >[0])
  return result
}

describe('WasteContainerObservations collection access', () => {
  it('lets anyone read observations', async () => {
    expect(await checkAccess('read', null)).toBe(true)
  })

  it('lets only city infrastructure admins record observations', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('create', { id: 1, role })).toBe(true)
    }
    for (const role of ['wasteCollector', 'user']) {
      expect(await checkAccess('create', { id: 5, role })).toBe(false)
    }
    expect(await checkAccess('create', null)).toBe(false)
  })

  it('lets only admins edit or delete observations', async () => {
    for (const operation of ['update', 'delete'] as const) {
      expect(await checkAccess(operation, { id: 1, role: 'admin' })).toBe(true)
      for (const role of ['inspector', 'containerAdmin', 'user']) {
        expect(await checkAccess(operation, { id: 2, role })).toBe(false)
      }
    }
  })
})

describe('WasteContainerObservations beforeChange hook', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(NOW) })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('records who cleaned the container and when', () => {
    expect(runBeforeChange({ container: 3 })).toEqual({
      container: 3,
      cleanedBy: 7,
      cleanedAt: NOW,
    })
  })

  it('keeps explicitly provided values', () => {
    const data = { container: 3, cleanedBy: 2, cleanedAt: '2026-01-01T00:00:00.000Z' }
    expect(runBeforeChange(data)).toEqual(data)
  })

  it('leaves cleanedBy empty without an authenticated user', () => {
    expect(runBeforeChange({ container: 3 }, null)).toEqual({ container: 3, cleanedAt: NOW })
  })
})
