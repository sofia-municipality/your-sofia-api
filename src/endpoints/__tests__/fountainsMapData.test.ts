jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { PayloadRequest } from 'payload'
import { FOUNTAIN_ADMIN_ROLES } from '@/access/cityInfrastructureAdmin'
import { fountainsMapData } from '../fountainsMapData'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type MapDataBody = { docs: unknown[]; totalDocs: number; total: number }

const isFragment = (value: unknown): value is SqlFragment =>
  typeof value === 'object' && value !== null && 'strings' in value && Array.isArray(value.strings)

// Renders the mocked sql`` object (including nested fragments) with `$` for params.
const renderSql = (query: SqlFragment): string =>
  query.strings.reduce((text, part, i) => {
    const value = query.values[i - 1]
    return text + (isFragment(value) ? renderSql(value) : '$') + part
  })

const sqlParams = (query: SqlFragment): unknown[] =>
  query.values.flatMap((value) => (isFragment(value) ? sqlParams(value) : [value]))

const mockRow = {
  id: 1,
  public_number: 'F-1',
  address: 'Vitosha Blvd 1',
  location: { type: 'Point', coordinates: [23.32, 42.69] },
  is_active: true,
  protection_status: 'protected',
  external_link: 'https://example.com/f-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  district_id: 3,
  source_id: 4,
  status: 'Работи',
  owner_id: 5,
  activation_type: 'Бутон',
  district_number: 12,
  district_name: 'Средец',
  source_name: 'Water main',
  owner_name: 'Sofia Municipality',
  signal_count: 2,
  active_signal_count: 1,
}

// First execute call returns the rows, the second returns the grand total.
const makePayload = (rows: unknown[] = [mockRow], totalRows: unknown[] = [{ total: 40 }]) => ({
  db: {
    drizzle: {
      execute: jest
        .fn<Promise<{ rows: unknown[] }>, [SqlFragment]>()
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce({ rows: totalRows }),
    },
  },
  logger: { error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, overrides: Record<string, unknown> = {}) =>
  ({
    query: {},
    user: { id: 'u1', role: 'fountainAdmin' },
    payload,
    ...overrides,
  }) as unknown as PayloadRequest

const executedQuery = (payload: MockPayload): SqlFragment => {
  const [call] = payload.db.drizzle.execute.mock.calls
  if (!call) throw new Error('Expected a SQL query to have been executed')
  return call[0]
}

describe('fountainsMapData endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload()
    const res = await fountainsMapData.handler(makeReq(payload, { user: null }))
    expect(res.status).toBe(401)
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  it('returns 403 for users without fountain access', async () => {
    for (const role of ['user', 'containerAdmin', 'wasteCollector']) {
      const payload = makePayload()
      const res = await fountainsMapData.handler(makeReq(payload, { user: { id: 'u1', role } }))
      expect(res.status).toBe(403)
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    }
  })

  it('allows every fountain admin role', async () => {
    for (const role of FOUNTAIN_ADMIN_ROLES) {
      const res = await fountainsMapData.handler(
        makeReq(makePayload(), { user: { id: 'u1', role } })
      )
      expect(res.status).toBe(200)
    }
  })

  it('maps rows to fountains and returns the grand total', async () => {
    const res = await fountainsMapData.handler(makeReq(makePayload()))

    expect(res.status).toBe(200)
    const body: MapDataBody = await res.json()
    expect(body.totalDocs).toBe(1)
    expect(body.total).toBe(40)
    expect(body.docs[0]).toEqual({
      id: 1,
      publicNumber: 'F-1',
      address: 'Vitosha Blvd 1',
      location: [23.32, 42.69],
      isActive: true,
      protectionStatus: 'protected',
      externalLink: 'https://example.com/f-1',
      district: 3,
      districtNumber: 12,
      districtName: 'Средец',
      source: 4,
      sourceName: 'Water main',
      status: 'Работи',
      owner: 5,
      ownerName: 'Sofia Municipality',
      activationType: 'Бутон',
      signalCount: 2,
      activeSignalCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('does not filter by bounds when bounds are missing or partial', async () => {
    for (const query of [{}, { minLat: '42.6', maxLat: '42.8', minLng: '23.2' }]) {
      const payload = makePayload()
      await fountainsMapData.handler(makeReq(payload, { query }))

      expect(renderSql(executedQuery(payload))).not.toContain('ST_MakeEnvelope')
    }
  })

  it('filters by the bounding box when all bounds are given', async () => {
    const payload = makePayload()
    await fountainsMapData.handler(
      makeReq(payload, {
        query: { minLat: '42.6', maxLat: '42.8', minLng: '23.2', maxLng: '23.4' },
      })
    )

    const query = executedQuery(payload)
    expect(renderSql(query)).toContain('WHERE df.location && ST_MakeEnvelope($, $, $, $, 4326)')
    expect(sqlParams(query)).toEqual([23.2, 42.6, 23.4, 42.8])
  })

  it('defaults the total to 0 when the count query returns no rows', async () => {
    const res = await fountainsMapData.handler(makeReq(makePayload([], [])))
    expect(await res.json()).toEqual({ docs: [], totalDocs: 0, total: 0 })
  })

  it('returns 500 and logs when the query fails', async () => {
    const payload = makePayload()
    payload.db.drizzle.execute.mockReset().mockRejectedValue(new Error('db down'))

    const res = await fountainsMapData.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch fountains map data',
      details: 'db down',
    })
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
