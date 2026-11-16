// @payloadcms/db-postgres uses ESM — mock the sql tag used by the container endpoints
jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn(),
}))

import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { WasteContainers } from '../WasteContainers'

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = WasteContainers.access?.[operation]
  if (!rule) throw new Error(`WasteContainers has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

describe('WasteContainers collection access', () => {
  it('lets anyone read containers', async () => {
    expect(await checkAccess('read', null)).toBe(true)
  })

  it('lets only city infrastructure admins create, edit or delete containers', async () => {
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

describe('WasteContainers beforeDelete hook', () => {
  it("deletes the container's observations within the same request", async () => {
    const hook = WasteContainers.hooks?.beforeDelete?.[0]
    if (!hook) throw new Error('WasteContainers has no beforeDelete hook')
    const req = { payload: { delete: jest.fn(async (_args: unknown) => ({ docs: [] })) } }

    await hook({ id: 3, req } as unknown as Parameters<typeof hook>[0])

    expect(req.payload.delete).toHaveBeenCalledWith({
      collection: 'waste-container-observations',
      where: { container: { equals: 3 } },
      overrideAccess: true,
      req,
    })
  })
})
