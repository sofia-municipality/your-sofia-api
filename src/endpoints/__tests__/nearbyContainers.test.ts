describe('nearbyContainers endpoint (unit)', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 400 for missing coordinates', async () => {
    // Mock the db-postgres module to prevent ESM parse errors
    jest.doMock('@payloadcms/db-postgres', () => ({ sql: jest.fn() }))
    const { nearbyContainers } = require('../nearbyContainers')

    const mockReq: any = {
      query: {},
      payload: { logger: { error: jest.fn() } },
    }

    const res: any = await nearbyContainers.handler(mockReq)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('queries db and returns containers on success', async () => {
    jest.doMock('@payloadcms/db-postgres', () => ({ sql: jest.fn() }))
    const { nearbyContainers } = require('../nearbyContainers')

    const row = {
      id: 1,
      public_number: 'P-1',
      location_latitude: '42.0',
      location_longitude: '23.0',
      location_address: 'Test St',
      capacity_volume: '100',
      capacity_size: 'L',
      service_interval: '7',
      serviced_by: 'City',
      waste_type: 'mixed',
      status: 'active',
      state: [],
      notes: 'Note',
      last_cleaned: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      distance: '123.45',
    }

    const mockDb = {
      drizzle: {
        execute: jest.fn(async () => ({ rows: [row] })),
      },
    }

    const mockPayload: any = {
      db: mockDb,
      logger: { error: jest.fn() },
    }

    const mockReq: any = {
      query: { latitude: '42.0', longitude: '23.0', radius: '500', limit: '10' },
      payload: mockPayload,
    }

    const res: any = await nearbyContainers.handler(mockReq)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('docs')
    expect(Array.isArray(body.docs)).toBe(true)
    expect(body.totalDocs).toBe(1)
    expect(body.docs[0]).toMatchObject({ id: 1, publicNumber: 'P-1', wasteType: 'mixed' })
    expect(mockDb.drizzle.execute).toHaveBeenCalled()
  })
})
