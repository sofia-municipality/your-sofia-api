import { cleanContainer } from '../cleanContainer'

describe('cleanContainer endpoint (unit)', () => {
  it('resolves active signals and updates container without photo', async () => {
    const mockContainer = { id: 1, publicNumber: 'P-100', status: 'dirty', state: ['full'] }

    const signals = {
      docs: [
        { id: 's1', status: 'open' },
        { id: 's2', status: 'open' },
      ],
    }

    const updatedContainer = {
      ...mockContainer,
      status: 'active',
      lastCleaned: new Date().toISOString(),
      state: [],
    }

    const mockPayload: any = {
      findByID: jest.fn(async ({ collection, id }) => {
        if (collection === 'waste-containers' && id === 1) return mockContainer
        return null
      }),
      find: jest.fn(async ({ collection }) => {
        if (collection === 'signals') return signals
        return { docs: [] }
      }),
      update: jest.fn(async ({ collection, id, data }) => {
        if (collection === 'signals') return { id, ...data }
        if (collection === 'waste-containers') return updatedContainer
        return null
      }),
      create: jest.fn(async () => ({})),
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    }

    const mockReq: any = {
      payload: mockPayload,
      user: { id: 'u1', role: 'containerAdmin', email: 'admin@test' },
      routeParams: { id: '1' },
      formData: async () => ({
        get: (key: string) => null,
      }),
    }

    const res: any = await cleanContainer.handler(mockReq)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.resolvedSignals).toBe(signals.docs.length)
    expect(body.observationId).toBeNull()
    expect(body.container).toEqual(updatedContainer)

    // Ensure signals were updated
    expect(mockPayload.update).toHaveBeenCalled()
    const signalUpdates = mockPayload.update.mock.calls.filter(
      (c: any[]) => c[0].collection === 'signals'
    )
    expect(signalUpdates.length).toBe(signals.docs.length)

    // Ensure container was updated
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'waste-containers' })
    )
  })

  it('returns 401 when unauthenticated', async () => {
    const mockReq: any = {
      payload: {},
      user: null,
      routeParams: { id: '1' },
      formData: async () => ({ get: () => null }),
    }

    const res: any = await cleanContainer.handler(mockReq)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})
