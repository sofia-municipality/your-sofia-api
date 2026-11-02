jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { PayloadRequest } from 'payload'

describe('nearbyContainers endpoint (unit)', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 400 for missing coordinates', async () => {
    const { nearbyContainers } = await import('../nearbyContainers')

    const mockReq = {
      query: {},
      payload: { logger: { error: jest.fn() } },
    } as unknown as PayloadRequest

    const res = await nearbyContainers.handler(mockReq)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 400 for a non-numeric radius', async () => {
    const { nearbyContainers } = await import('../nearbyContainers')

    const execute = jest.fn()
    const mockReq = {
      query: { latitude: '42.0', longitude: '23.0', radius: 'abc' },
      payload: { db: { drizzle: { execute } }, logger: { error: jest.fn() } },
    } as unknown as PayloadRequest

    const res = await nearbyContainers.handler(mockReq)
    expect(res.status).toBe(400)
    const body: { error: string } = await res.json()
    expect(body.error).toMatch(/Radius/)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric or non-positive limit', async () => {
    const { nearbyContainers } = await import('../nearbyContainers')

    for (const limit of ['abc', '0', '-1']) {
      const execute = jest.fn()
      const mockReq = {
        query: { latitude: '42.0', longitude: '23.0', limit },
        payload: { db: { drizzle: { execute } }, logger: { error: jest.fn() } },
      } as unknown as PayloadRequest

      const res = await nearbyContainers.handler(mockReq)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body).toHaveProperty('error', 'Limit must be a positive integer')
      expect(execute).not.toHaveBeenCalled()
    }
  })

  it('queries using Payload API and returns containers on success', async () => {
    const { nearbyContainers } = await import('../nearbyContainers')

    const createdAt = new Date().toISOString()
    const updatedAt = new Date().toISOString()

    const mockRow = {
      id: 1,
      public_number: 'P-1',
      location: { type: 'Point', coordinates: [23.0, 42.0] },
      address: 'Test St',
      capacity_volume: '100',
      capacity_size: 'L',
      serviced_by: 'City',
      waste_type: 'mixed',
      status: 'active',
      state: [],
      notes: 'Note',
      last_cleaned: null,
      created_at: createdAt,
      updated_at: updatedAt,
      distance: '42.4',
    }

    const mockPayload = {
      db: {
        drizzle: {
          execute: jest.fn(async () => ({ rows: [mockRow] })),
        },
      },
      logger: { error: jest.fn() },
    }

    const mockReq = {
      query: { latitude: '42.0', longitude: '23.0', radius: '500', limit: '10' },
      payload: mockPayload,
    } as unknown as PayloadRequest

    const res = await nearbyContainers.handler(mockReq)
    expect(res.status).toBe(200)
    const body: { docs: unknown[]; totalDocs: number } = await res.json()
    expect(body).toHaveProperty('docs')
    expect(Array.isArray(body.docs)).toBe(true)
    expect(body.totalDocs).toBe(1)
    expect(body.docs[0]).toMatchObject({ id: 1, publicNumber: 'P-1', wasteType: 'mixed' })
    expect(mockPayload.db.drizzle.execute).toHaveBeenCalledTimes(1)
  })
})
