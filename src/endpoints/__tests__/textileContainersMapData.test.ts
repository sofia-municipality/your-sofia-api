jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { PayloadRequest } from 'payload'
import { textileContainersMapData } from '../textileContainersMapData'

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
  id: 7,
  number: '15',
  address: 'Tsar Boris III Blvd 20',
  location: { type: 'Point', coordinates: [23.29, 42.68] },
  status: 'active',
  notes: 'Next to the bus stop',
  district_id: 2,
  company_id: 3,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  district_number: 9,
  district_name: 'Красно село',
  company_name: 'Textile Co',
  signal_count: 4,
  active_signal_count: 1,
}

// First execute call returns the rows, the second returns the grand total.
const makePayload = (rows: unknown[] = [mockRow], totalRows: unknown[] = [{ total: 25 }]) => ({
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

const makeReq = (payload: MockPayload, query: Record<string, unknown> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

const executedQuery = (payload: MockPayload): SqlFragment => {
  const [call] = payload.db.drizzle.execute.mock.calls
  if (!call) throw new Error('Expected a SQL query to have been executed')
  return call[0]
}

describe('textileContainersMapData endpoint (unit)', () => {
  it('maps rows to containers and returns the grand total', async () => {
    const payload = makePayload()

    const res = await textileContainersMapData.handler(makeReq(payload))

    expect(res.status).toBe(200)
    const body: MapDataBody = await res.json()
    expect(body.totalDocs).toBe(1)
    expect(body.total).toBe(25)
    expect(body.docs[0]).toEqual({
      id: 7,
      number: 15,
      address: 'Tsar Boris III Blvd 20',
      location: [23.29, 42.68],
      status: 'active',
      notes: 'Next to the bus stop',
      district: 2,
      districtNumber: 9,
      districtName: 'Красно село',
      company: 3,
      companyName: 'Textile Co',
      signalCount: 4,
      activeSignalCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
  })

  it('keeps a null container number as null', async () => {
    const res = await textileContainersMapData.handler(
      makeReq(makePayload([{ ...mockRow, number: null }]))
    )
    const body: MapDataBody = await res.json()
    expect(body.docs[0]).toMatchObject({ number: null })
  })

  it('does not filter by bounds when no bounds are given', async () => {
    const payload = makePayload()
    await textileContainersMapData.handler(makeReq(payload))

    const query = executedQuery(payload)
    expect(renderSql(query)).not.toContain('ST_MakeEnvelope')
    expect(sqlParams(query)).toEqual([])
  })

  it('ignores partial bounds', async () => {
    const payload = makePayload()
    await textileContainersMapData.handler(
      makeReq(payload, { minLat: '42.6', maxLat: '42.8', minLng: '23.2' })
    )

    expect(renderSql(executedQuery(payload))).not.toContain('ST_MakeEnvelope')
  })

  it('filters by the bounding box when all bounds are given', async () => {
    const payload = makePayload()
    await textileContainersMapData.handler(
      makeReq(payload, { minLat: '42.6', maxLat: '42.8', minLng: '23.2', maxLng: '23.4' })
    )

    const query = executedQuery(payload)
    expect(renderSql(query)).toContain('WHERE tc.location && ST_MakeEnvelope($, $, $, $, 4326)')
    expect(sqlParams(query)).toEqual([23.2, 42.6, 23.4, 42.8])
  })

  it('defaults the total to 0 when the count query returns no rows', async () => {
    const res = await textileContainersMapData.handler(makeReq(makePayload([], [])))
    expect(await res.json()).toEqual({ docs: [], totalDocs: 0, total: 0 })
  })

  it('returns 500 and logs when the query fails', async () => {
    const payload = makePayload()
    payload.db.drizzle.execute.mockReset().mockRejectedValue(new Error('db down'))

    const res = await textileContainersMapData.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch textile containers map data',
      details: 'db down',
    })
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
