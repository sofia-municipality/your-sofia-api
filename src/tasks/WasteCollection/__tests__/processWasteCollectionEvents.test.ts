/**
 * Unit tests for processWasteCollectionEvents task handler.
 *
 * Strategy: mock fetch + payload + drizzle; drive the handler through all
 * branches and assert the right Payload/DB calls were made.
 */

import type { WasteCollectionEvent } from '../gpsCollectionHelpers'

// ── Stable sql tag mock (returns a tagged-template object) ───────────────────
jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}))

// ── Shared GPS event factory ─────────────────────────────────────────────────
function makeEvent(overrides: Partial<WasteCollectionEvent> = {}): WasteCollectionEvent {
  return {
    Id: 1,
    GpsTime: '2026-04-30 10:00:00',
    ReceiveTime: '2026-04-30 10:00:05',
    Region: 24,
    VehicleId: 1001,
    Longitude: 23.32,
    Latitude: 42.69,
    Altitude: null,
    Angle: 0,
    Satelites: 8,
    Speed: 0,
    SpecificationType: 1,
    Contact: true,
    Plow: null,
    Spreader: null,
    Shooter: true,
    Pump: null,
    Brushes: null,
    FirmId: 95,
    ...overrides,
  }
}

// ── Helper: build a fully-wired mock payload object ─────────────────────────
const MOCK_DISTRICTS = [
  { id: 10, districtId: 24, code: 'RTR' },
  { id: 11, districtId: 1, code: 'RSE' },
]

function makeMockPayload({
  drizzleRows = [] as any[],
  createResult = { id: 9999 },
  featureFlagEnabled = false,
}: { drizzleRows?: any[]; createResult?: { id: number }; featureFlagEnabled?: boolean } = {}) {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    find: jest.fn().mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'city-districts') return { docs: MOCK_DISTRICTS }
      if (collection === 'feature-config') {
        return { docs: featureFlagEnabled ? [{ enabled: true }] : [] }
      }
      return { docs: [] }
    }),
    create: jest.fn(async () => createResult),
    update: jest.fn(async () => ({})),
    db: {
      drizzle: {
        execute: jest.fn(async () => ({ rows: drizzleRows })),
      },
    },
  }
}

// ── fetch mock helpers ───────────────────────────────────────────────────────
function mockFetch(firmIds: number[], events: WasteCollectionEvent[]) {
  ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    if (url.includes('get_fid')) {
      return { ok: true, json: async () => firmIds }
    }
    if (url.includes('get_vehicle')) {
      return { ok: true, json: async () => events }
    }
    return { ok: false, status: 500, statusText: 'Unknown' }
  })
}

// ── Setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  global.fetch = jest.fn()
  process.env.INSPECTORAT_GPS_API_BASE_URL = 'https://gps.test'
  process.env.INSPECTORAT_GPS_API_KEY = 'test-key'
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('processWasteCollectionEvents handler', () => {
  it('throws when the T1 firm-list request fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    })

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const mockPayload = makeMockPayload()

    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }
    const req: any = { payload: mockPayload }

    await expect((processWasteCollectionEvents as any).handler({ input, req })).rejects.toThrow(
      'GPS T1 failed'
    )
  })

  it('warns and skips when the T2 vehicle request fails for a firm', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [95] }) // T1 ok
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' }) // T2 fail

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const mockPayload = makeMockPayload()
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GPS T2 failed for firmId=95')
    )
    expect(result.output.containersUpdated).toBe(0)
  })

  it('skips non-shooter events and processes nothing when no Shooter=true events exist', async () => {
    const events = [makeEvent({ Shooter: false }), makeEvent({ Shooter: null })]
    mockFetch([95], events)

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const mockPayload = makeMockPayload()
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).not.toHaveBeenCalled()
    expect(mockPayload.update).not.toHaveBeenCalled()
    expect(result.output.containersUpdated).toBe(0)
    expect(result.output.observationsCreated).toBe(0)
  })

  it('creates a new container when no nearby container is found (feature flag enabled)', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    // drizzle returns empty rows → no nearby container
    const mockPayload = makeMockPayload({
      drizzleRows: [],
      createResult: { id: 7777 },
      featureFlagEnabled: true,
    })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).toHaveBeenCalledTimes(1)
    const createCall = (mockPayload.create.mock.calls[0] as any[])[0] as any
    expect(createCall.collection).toBe('waste-containers')
    expect(createCall.data.status).toBe('pending')
    expect(createCall.data.source).toBe('third_party')
    // publicNumber uses district code "RTR" (region 24 → id 10, code RTR)
    expect(createCall.data.publicNumber).toMatch(/^RTR-/)
    expect(createCall.data.district).toBe(10)

    // observation is inserted after create
    expect(mockPayload.db.drizzle.execute).toHaveBeenCalledTimes(2) // nearest query + observation
    expect(result.output.observationsCreated).toBe(1)
  })

  it('updates existing container when a nearby container is found (with district set)', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    // drizzle returns a container row that already has a district
    const mockPayload = makeMockPayload({
      drizzleRows: [{ id: 42, district_id: 10, status: 'full' }],
    })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).not.toHaveBeenCalled()
    expect(mockPayload.update).toHaveBeenCalledTimes(1)

    const updateCall = (mockPayload.update.mock.calls[0] as any[])[0] as any
    expect(updateCall.collection).toBe('waste-containers')
    expect(updateCall.id).toBe(42)
    expect(updateCall.data.status).toBe('active')
    expect(updateCall.data.servicedBy).toBe('Фирма: 95')
    // district already set → should NOT overwrite it
    expect(updateCall.data.district).toBeUndefined()

    expect(result.output.containersUpdated).toBe(1)
    expect(result.output.observationsCreated).toBe(1)
  })

  it('resolves open waste-container signals and adds an auto-close note', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    const mockPayload = makeMockPayload({
      drizzleRows: [{ id: 42, public_number: 'RTR-123', district_id: 10, status: 'full' }],
    })
    // Extend base routing to also handle the signals find inside resolveOpenContainerSignals
    mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'city-districts') return { docs: MOCK_DISTRICTS }
      if (collection === 'feature-config') return { docs: [] }
      if (collection === 'signals') return { docs: [{ id: 1, districtId: 24, code: 'RTR' }] }
      return { docs: [] }
    })

    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).not.toHaveBeenCalled()
    expect(mockPayload.update).toHaveBeenCalledTimes(2)
    const signalUpdateCall = (mockPayload.update.mock.calls[1] as any[])[0] as any
    expect(signalUpdateCall.collection).toBe('signals')
    expect(signalUpdateCall.id).toBe(1)
    expect(signalUpdateCall.data.status).toBe('resolved')
    expect(signalUpdateCall.data.description).toContain('Автоматично затворен от GPS синхронизация')
  })

  it('fills in missing district when container has no district_id', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    // Container exists but has no district
    const mockPayload = makeMockPayload({
      drizzleRows: [{ id: 42, district_id: null }],
    })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    await (processWasteCollectionEvents as any).handler({ input, req })

    const updateCall = (mockPayload.update.mock.calls[0] as any[])[0] as any
    // Region 24 → Payload district id 10
    expect(updateCall.data.district).toBe(10)
  })

  it('logs error and continues when payload.update throws', async () => {
    const event = makeEvent()
    mockFetch([95], [event])

    const mockPayload = makeMockPayload({ drizzleRows: [{ id: 42, district_id: 10 }] })
    mockPayload.update.mockRejectedValueOnce(new Error('DB constraint'))

    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    // Should NOT throw — error is caught and logged
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update container 42')
    )
    // observation is still created even though the update failed
    expect(result.output.observationsCreated).toBe(1)
    expect(result.output.containersUpdated).toBe(0)
  })

  it('groups nearby shooter events into a single spot', async () => {
    // Two events from the same vehicle within 20 m of each other → one spot
    const e1 = makeEvent({ VehicleId: 1001, Longitude: 23.32, Latitude: 42.69 })
    const e2 = makeEvent({
      VehicleId: 1001,
      Longitude: 23.3201,
      Latitude: 42.6901,
      GpsTime: '2026-04-30 10:01:00',
    })
    mockFetch([95], [e1, e2])

    const mockPayload = makeMockPayload({ drizzleRows: [{ id: 55, district_id: 10 }] })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    await (processWasteCollectionEvents as any).handler({ input, req })

    // Only one spot → one update, one observation
    expect(mockPayload.update).toHaveBeenCalledTimes(1)
    // nearest query + one observation insert
    expect(mockPayload.db.drizzle.execute).toHaveBeenCalledTimes(2)
  })

  it('processes multiple firms independently', async () => {
    const e1 = makeEvent({ FirmId: 10, VehicleId: 1 })
    const e2 = makeEvent({ FirmId: 20, VehicleId: 2, Longitude: 23.33, Latitude: 42.7 })
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [10, 20] }) // T1
      .mockResolvedValueOnce({ ok: true, json: async () => [e1] }) // T2 firm 10
      .mockResolvedValueOnce({ ok: true, json: async () => [e2] }) // T2 firm 20

    const mockPayload = makeMockPayload({ drizzleRows: [{ id: 100, district_id: 10 }] })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(result.output.firmsProcessed).toBe(2)
    expect(mockPayload.update).toHaveBeenCalledTimes(2)
    expect(result.output.containersUpdated).toBe(2)
  })

  it('returns correct output schema fields', async () => {
    mockFetch([], [])

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const mockPayload = makeMockPayload()
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const result = await (processWasteCollectionEvents as any).handler({
      input,
      req: { payload: mockPayload },
    })

    expect(result).toHaveProperty('output')
    expect(result.output).toMatchObject({
      firmsProcessed: expect.any(Number),
      pointsTotal: expect.any(Number),
      containersUpdated: expect.any(Number),
      observationsCreated: expect.any(Number),
    })
  })

  it('warns and skips container creation when feature flag is disabled', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    // No nearby container, feature flag OFF (default)
    const mockPayload = makeMockPayload({ drizzleRows: [], featureFlagEnabled: false })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).not.toHaveBeenCalled()
    expect(mockPayload.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('creation disabled')
    )
    expect(result.output.observationsCreated).toBe(0)
  })

  it('creates a pending container when no nearby container found and feature flag is enabled', async () => {
    const event = makeEvent({ Region: 24 })
    mockFetch([95], [event])

    const mockPayload = makeMockPayload({
      drizzleRows: [],
      createResult: { id: 8888 },
      featureFlagEnabled: true,
    })
    const req: any = { payload: mockPayload }
    const input = { from: '2026-04-30 09:00', to: '2026-04-30 10:00' }

    const { processWasteCollectionEvents } = await import('../processWasteCollectionEvents')
    const result = await (processWasteCollectionEvents as any).handler({ input, req })

    expect(mockPayload.create).toHaveBeenCalledTimes(1)
    const createCall = (mockPayload.create.mock.calls[0] as any[])[0] as any
    expect(createCall.collection).toBe('waste-containers')
    expect(createCall.data.status).toBe('pending')
    expect(createCall.data.source).toBe('third_party')
    expect(createCall.data.publicNumber).toMatch(/^RTR-/)
    // observation is still inserted for the auto-created container
    expect(result.output.observationsCreated).toBe(1)
  })
})
