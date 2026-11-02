import type { PayloadRequest } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { bulkUpdateContainerStatus } from '../bulkUpdateContainerStatus'

type ErrorBody = { error: string }
type UpdateArgs = { where: { id: { in: number[] } } }

const makePayload = () => ({
  update: jest.fn(async ({ where }: UpdateArgs) => ({
    docs: where.id.in.map((id) => ({ id })),
  })),
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, body: unknown, overrides: Record<string, unknown> = {}) =>
  ({
    payload,
    user: { id: 'u1', role: 'containerAdmin' },
    json: async () => body,
    ...overrides,
  }) as unknown as PayloadRequest

describe('bulkUpdateContainerStatus endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await bulkUpdateContainerStatus.handler(
      makeReq(makePayload(), { ids: [1], status: 'full' }, { user: null })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for roles outside city infrastructure admins', async () => {
    for (const role of ['user', 'wasteCollector', undefined]) {
      const payload = makePayload()
      const res = await bulkUpdateContainerStatus.handler(
        makeReq(payload, { ids: [1], status: 'full' }, { user: { id: 'u1', role } })
      )
      expect(res.status).toBe(403)
      expect(payload.update).not.toHaveBeenCalled()
    }
  })

  it('returns 400 when the request has no JSON reader', async () => {
    const res = await bulkUpdateContainerStatus.handler(
      makeReq(makePayload(), null, { json: undefined })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
  })

  it('returns 400 for an invalid JSON body', async () => {
    const res = await bulkUpdateContainerStatus.handler(
      makeReq(makePayload(), null, {
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when ids is missing, not an array or empty', async () => {
    for (const ids of [undefined, '1,2', []]) {
      const res = await bulkUpdateContainerStatus.handler(
        makeReq(makePayload(), { ids, status: 'full' })
      )
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'ids must be a non-empty array' })
    }
  })

  it('returns 400 for an unknown or non-string status', async () => {
    for (const status of [undefined, 'broken', 1]) {
      const res = await bulkUpdateContainerStatus.handler(
        makeReq(makePayload(), { ids: [1], status })
      )
      expect(res.status).toBe(400)
      const body: ErrorBody = await res.json()
      expect(body.error).toMatch(/^status must be one of:/)
    }
  })

  it('returns 400 when none of the ids are positive integers', async () => {
    const payload = makePayload()
    const res = await bulkUpdateContainerStatus.handler(
      makeReq(payload, { ids: ['abc', -1, 0, 1.5, null], status: 'full' })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'No valid numeric ids provided' })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('updates the status of the valid ids only', async () => {
    const payload = makePayload()

    const res = await bulkUpdateContainerStatus.handler(
      makeReq(payload, { ids: ['1', 2, 'x', -3], status: 'maintenance' })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, updated: 2, ids: [1, 2] })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'waste-containers',
      where: { id: { in: [1, 2] } },
      data: { status: 'maintenance' },
    })
  })

  it('allows every city infrastructure admin role', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      const res = await bulkUpdateContainerStatus.handler(
        makeReq(makePayload(), { ids: [1], status: 'active' }, { user: { id: 'u1', role } })
      )
      expect(res.status).toBe(200)
    }
  })

  it('returns 500 with details when the update fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const payload = makePayload()
    payload.update.mockRejectedValue(new Error('db down'))

    const res = await bulkUpdateContainerStatus.handler(
      makeReq(payload, { ids: [1], status: 'full' })
    )

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update containers', details: 'db down' })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
