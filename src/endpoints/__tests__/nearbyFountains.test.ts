jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { PayloadRequest } from 'payload'
import { nearbyFountains } from '../nearbyFountains'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type ErrorBody = { error: string }
type NearbyBody = { docs: unknown[]; totalDocs: number; limit: number }

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
  distance: 42.6,
}

const makePayload = (rows: unknown[] = [mockRow]) => ({
  db: { drizzle: { execute: jest.fn(async (_query: SqlFragment) => ({ rows })) } },
  logger: { error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, unknown>) =>
  ({ query, payload }) as unknown as PayloadRequest

const executedQuery = (payload: MockPayload): SqlFragment => {
  const [call] = payload.db.drizzle.execute.mock.calls
  if (!call) throw new Error('Expected a SQL query to have been executed')
  return call[0]
}

const validQuery = { latitude: '42.69', longitude: '23.32' }

describe('nearbyFountains endpoint (unit)', () => {
  it('returns 400 for missing or non-numeric coordinates', async () => {
    for (const query of [{}, { latitude: '42.69' }, { latitude: 'abc', longitude: '23.32' }]) {
      const payload = makePayload()
      const res = await nearbyFountains.handler(makeReq(payload, query))
      expect(res.status).toBe(400)
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    }
  })

  it('returns 400 for out-of-range coordinates', async () => {
    for (const query of [
      { latitude: '91', longitude: '23' },
      { latitude: '-91', longitude: '23' },
      { latitude: '42', longitude: '181' },
      { latitude: '42', longitude: '-181' },
    ]) {
      const res = await nearbyFountains.handler(makeReq(makePayload(), query))
      expect(res.status).toBe(400)
    }
  })

  it('returns 400 for a radius outside (0, 10000]', async () => {
    for (const radius of ['0', '-5', '10001']) {
      const res = await nearbyFountains.handler(makeReq(makePayload(), { ...validQuery, radius }))
      expect(res.status).toBe(400)
      const body: ErrorBody = await res.json()
      expect(body.error).toMatch(/Radius/)
    }
  })

  it('returns 400 for a non-numeric radius', async () => {
    const payload = makePayload()
    const res = await nearbyFountains.handler(makeReq(payload, { ...validQuery, radius: 'abc' }))
    expect(res.status).toBe(400)
    const body: ErrorBody = await res.json()
    expect(body.error).toMatch(/Radius/)
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric or non-positive limit', async () => {
    for (const limit of ['abc', '0', '-1']) {
      const payload = makePayload()
      const res = await nearbyFountains.handler(makeReq(payload, { ...validQuery, limit }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Limit must be a positive integer' })
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    }
  })

  it('maps rows to fountains with pagination metadata', async () => {
    const res = await nearbyFountains.handler(makeReq(makePayload(), validQuery))

    expect(res.status).toBe(200)
    const body: NearbyBody = await res.json()
    expect(body).toMatchObject({
      totalDocs: 1,
      limit: 100,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    })
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
      statusName: 'Работи',
      owner: 5,
      ownerName: 'Sofia Municipality',
      activationType: 'Бутон',
      activationName: 'Бутон',
      signalCount: 2,
      activeSignalCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      distance: 43,
    })
  })

  it('uses the default radius of 300 meters and passes query params to SQL', async () => {
    const payload = makePayload()
    await nearbyFountains.handler(makeReq(payload, validQuery))

    const query = executedQuery(payload)
    expect(sqlParams(query)).toEqual([23.32, 42.69, 23.32, 42.69, 300, 100])
    expect(renderSql(query)).not.toContain('is_active IS TRUE')
  })

  it('applies custom radius, limit and onlyActive filter', async () => {
    const payload = makePayload()

    const res = await nearbyFountains.handler(
      makeReq(payload, { ...validQuery, radius: '500', limit: '5', onlyActive: 'true' })
    )

    const body: NearbyBody = await res.json()
    expect(body.limit).toBe(5)
    const query = executedQuery(payload)
    expect(sqlParams(query)).toEqual([23.32, 42.69, 23.32, 42.69, 500, 5])
    expect(renderSql(query)).toContain('AND df.is_active IS TRUE')
  })

  it('returns an empty list when no fountains are nearby', async () => {
    const res = await nearbyFountains.handler(makeReq(makePayload([]), validQuery))
    const body: NearbyBody = await res.json()
    expect(body.docs).toEqual([])
    expect(body.totalDocs).toBe(0)
  })

  it('returns 500 and logs when the query fails', async () => {
    const payload = makePayload()
    payload.db.drizzle.execute.mockRejectedValue(new Error('db down'))

    const res = await nearbyFountains.handler(makeReq(payload, validQuery))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch nearby fountains',
      details: 'db down',
    })
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
