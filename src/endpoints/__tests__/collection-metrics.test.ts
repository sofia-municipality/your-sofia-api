jest.mock('@payloadcms/db-postgres', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
  // Represent sql.join as a fragment that interleaves the separator between the chunks.
  const join = (chunks: unknown[], separator: unknown) => {
    const values = chunks.flatMap((chunk, i) => (i === 0 ? [chunk] : [separator, chunk]))
    return { strings: Array<string>(values.length + 1).fill(''), values }
  }
  return { sql: Object.assign(jest.fn(sql), { join: jest.fn(join) }) }
})

import type { PayloadRequest } from 'payload'
import { collectionMetrics } from '../collection-metrics'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type Row = Record<string, unknown>
type MetricsBody = {
  from: string
  to: string
  byDistrict: Row[]
  byZone: Row[]
  byDay: Row[]
  byTimeSinceCollection: Row[]
  scheduleCompliance: { scheduledToday: number; delayed: number; missed: number }
}
type QueryRows = {
  district?: Row[]
  zone?: Row[]
  histogram?: Row[]
  dailyTrend?: Row[]
  compliance?: Row[]
}

const isFragment = (value: unknown): value is SqlFragment =>
  typeof value === 'object' && value !== null && 'strings' in value && Array.isArray(value.strings)

// Renders the mocked sql`` object (including nested fragments) with `$` for params.
const renderSql = (query: SqlFragment): string =>
  query.strings
    .reduce((text, part, i) => {
      const value = query.values[i - 1]
      return text + (isFragment(value) ? renderSql(value) : '$') + part
    })
    .replace(/\s+/g, ' ')

const sqlParams = (query: SqlFragment): unknown[] =>
  query.values.flatMap((value) => (isFragment(value) ? sqlParams(value) : [value]))

// The handler runs five queries in order: district, zone, histogram, daily trend, compliance.
const QUERY = { district: 0, zone: 1, histogram: 2, dailyTrend: 3, compliance: 4 } as const

const makePayload = (rows: QueryRows = {}) => {
  const execute = jest.fn(async (_query: SqlFragment) => ({ rows: [] as Row[] }))
  execute
    .mockResolvedValueOnce({ rows: rows.district ?? [] })
    .mockResolvedValueOnce({ rows: rows.zone ?? [] })
    .mockResolvedValueOnce({ rows: rows.histogram ?? [] })
    .mockResolvedValueOnce({ rows: rows.dailyTrend ?? [] })
    .mockResolvedValueOnce({ rows: rows.compliance ?? [] })
  return { db: { drizzle: { execute } } }
}

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, unknown> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

const executedQuery = (payload: MockPayload, name: keyof typeof QUERY): SqlFragment => {
  const call = payload.db.drizzle.execute.mock.calls[QUERY[name]]
  if (!call) throw new Error(`Expected the ${name} query to have been executed`)
  return call[0]
}

describe('collectionMetrics endpoint (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('date range', () => {
    it('defaults to the last 7 days up to now', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-15T10:30:00.000Z') })
      const payload = makePayload()

      const res = await collectionMetrics.handler(makeReq(payload))

      expect(res.status).toBe(200)
      const body: MetricsBody = await res.json()
      expect(body.from).toBe('2026-06-08T10:30:00.000Z')
      expect(body.to).toBe('2026-06-15T10:30:00.000Z')
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(5)
      expect(sqlParams(executedQuery(payload, 'district'))).toEqual([
        '2026-06-08T10:30:00.000Z',
        '2026-06-15T10:30:00.000Z',
      ])
    })

    it('uses custom from/to as given and passes them to every windowed query', async () => {
      const from = '2026-01-05T00:00:00.000Z'
      const to = '2026-01-10T23:59:59.000Z'
      const payload = makePayload()

      const res = await collectionMetrics.handler(makeReq(payload, { from, to }))

      const body: MetricsBody = await res.json()
      expect(body.from).toBe(from)
      expect(body.to).toBe(to)
      expect(sqlParams(executedQuery(payload, 'district'))).toEqual([from, to])
      expect(sqlParams(executedQuery(payload, 'zone'))).toEqual([from, to])
      expect(sqlParams(executedQuery(payload, 'dailyTrend'))).toEqual([from, to, from, to])
      expect(sqlParams(executedQuery(payload, 'histogram'))).toEqual([])
      expect(sqlParams(executedQuery(payload, 'compliance'))).toEqual([])
    })

    it('falls back to the defaults for unparseable dates', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-15T10:30:00.000Z') })

      const res = await collectionMetrics.handler(
        makeReq(makePayload(), { from: 'not-a-date', to: 'also-not-a-date' })
      )

      const body: MetricsBody = await res.json()
      expect(body.from).toBe('2026-06-08T10:30:00.000Z')
      expect(body.to).toBe('2026-06-15T10:30:00.000Z')
    })
  })

  describe('district and volume filters', () => {
    const from = '2026-01-01T00:00:00.000Z'
    const to = '2026-01-02T00:00:00.000Z'

    it('keeps only positive integer district ids and positive volumes', async () => {
      const payload = makePayload()

      await collectionMetrics.handler(
        makeReq(payload, {
          from,
          to,
          districtIds: '1, 2,abc,-3,0',
          volumeOptions: '1.1, 3,x,-2,0',
        })
      )

      const filters = [1, 2, 1.1, 3]
      expect(sqlParams(executedQuery(payload, 'district'))).toEqual([from, to, ...filters])
      expect(sqlParams(executedQuery(payload, 'zone'))).toEqual([from, to, ...filters])
      expect(sqlParams(executedQuery(payload, 'histogram'))).toEqual(filters)
      expect(sqlParams(executedQuery(payload, 'dailyTrend'))).toEqual([
        from,
        to,
        ...filters,
        from,
        to,
        ...filters,
      ])
      expect(sqlParams(executedQuery(payload, 'compliance'))).toEqual([...filters, ...filters])
    })

    it('accepts repeated district and volume params', async () => {
      const payload = makePayload()

      await collectionMetrics.handler(
        makeReq(payload, { from, to, districtIds: ['4', '5'], volumeOptions: ['1.1', '3.2'] })
      )

      expect(sqlParams(executedQuery(payload, 'histogram'))).toEqual([4, 5, 1.1, 3.2])
    })

    it.each([
      ['districtIds', 'abc,-1'],
      ['volumeOptions', 'x,0'],
    ])('matches nothing when %s is given but contains no valid values', async (param, value) => {
      const payload = makePayload()

      await collectionMetrics.handler(makeReq(payload, { from, to, [param]: value }))

      for (const name of Object.keys(QUERY) as Array<keyof typeof QUERY>) {
        const query = executedQuery(payload, name)
        expect(renderSql(query)).toContain('AND FALSE')
      }
      expect(sqlParams(executedQuery(payload, 'histogram'))).toEqual([])
    })

    it('does not filter when neither param is given', async () => {
      const payload = makePayload()

      await collectionMetrics.handler(makeReq(payload, { from, to }))

      expect(renderSql(executedQuery(payload, 'district'))).not.toContain('AND FALSE')
      expect(sqlParams(executedQuery(payload, 'histogram'))).toEqual([])
    })
  })

  describe('response mapping', () => {
    it('maps every result set to camelCase', async () => {
      const payload = makePayload({
        district: [
          {
            district_id: 1,
            district_name: 'Sredets',
            total_containers: 10,
            collected_containers: 7,
          },
          { district_id: 2, district_name: null, total_containers: 4, collected_containers: 0 },
        ],
        zone: [
          {
            zone_id: 11,
            zone_number: 1,
            zone_name: 'Zone 1',
            service_company_id: 5,
            total_containers: 14,
            collected_containers: 7,
          },
          {
            zone_id: 12,
            zone_number: 2,
            zone_name: 'Zone 2',
            total_containers: 0,
            collected_containers: 0,
          },
        ],
        histogram: [
          { bucket: '<1 ден', bucket_order: 0, container_count: 9 },
          { bucket: '14+', bucket_order: 5, container_count: 1 },
        ],
        dailyTrend: [
          { day_iso: '2026-01-01', total_containers: 14, collected_containers: 3 },
          { day_iso: '2026-01-02', total_containers: 12, collected_containers: 0 },
        ],
        compliance: [{ scheduled_today: 20, delayed: 2, missed: 1 }],
      })

      const res = await collectionMetrics.handler(
        makeReq(payload, { from: '2026-01-01', to: '2026-01-02' })
      )

      const body: MetricsBody = await res.json()
      expect(body.byDistrict).toEqual([
        { districtId: 1, districtName: 'Sredets', totalContainers: 10, collectedContainers: 7 },
        { districtId: 2, districtName: 'District 2', totalContainers: 4, collectedContainers: 0 },
      ])
      expect(body.byZone).toEqual([
        {
          zoneNumber: 1,
          zoneName: 'Zone 1',
          serviceCompanyId: 5,
          totalContainers: 14,
          collectedContainers: 7,
        },
        {
          zoneNumber: 2,
          zoneName: 'Zone 2',
          serviceCompanyId: null,
          totalContainers: 0,
          collectedContainers: 0,
        },
      ])
      expect(body.byTimeSinceCollection).toEqual([
        { bucket: '<1 ден', bucketOrder: 0, containerCount: 9 },
        { bucket: '14+', bucketOrder: 5, containerCount: 1 },
      ])
      expect(body.byDay).toEqual([
        { date: '2026-01-01', totalContainers: 14, collectedContainers: 3 },
        { date: '2026-01-02', totalContainers: 12, collectedContainers: 0 },
      ])
      expect(body.scheduleCompliance).toEqual({ scheduledToday: 20, delayed: 2, missed: 1 })
    })

    it('returns empty lists and zeroed compliance when there is no data', async () => {
      const res = await collectionMetrics.handler(
        makeReq(makePayload(), { from: '2026-01-01', to: '2026-01-02' })
      )

      expect(await res.json()).toEqual({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        byDistrict: [],
        byZone: [],
        byDay: [],
        byTimeSinceCollection: [],
        scheduleCompliance: { scheduledToday: 0, delayed: 0, missed: 0 },
      })
    })
  })

  describe('errors', () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('returns 500 with details when a later query fails', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockReset()
      payload.db.drizzle.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('zone query failed'))

      const res = await collectionMetrics.handler(makeReq(payload))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        error: 'Failed to fetch collection metrics',
        details: 'zone query failed',
      })
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('reports "Unknown error" when a non-Error is thrown', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockReset()
      payload.db.drizzle.execute.mockRejectedValue('boom')

      const res = await collectionMetrics.handler(makeReq(payload))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        error: 'Failed to fetch collection metrics',
        details: 'Unknown error',
      })
    })
  })
})
