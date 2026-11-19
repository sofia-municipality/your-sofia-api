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
import { containersWithSignalCount } from '../containers-with-signals'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type Row = Record<string, unknown>
type Totals = { total: number; filteredTotal: number }
type ClusterDoc = {
  type: 'cluster'
  lat: number
  lng: number
  count: number
  dominantStatus: string
  activeSignalCount: number
}
type ClustersBody = Totals & { type: 'clusters'; docs: ClusterDoc[]; zoom: number }
type MarkersBody = Totals & { type: 'markers'; docs: Row[]; zoom: number }

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

// The handler runs three queries in order: grand total, filtered total, map (clusters/markers).
const makePayload = (rows: Row[] = [], totals: Partial<Totals> = {}) => {
  const execute = jest.fn(async (_query: SqlFragment) => ({ rows: [] as Row[] }))
  execute
    .mockResolvedValueOnce({ rows: [{ total: totals.total ?? 0 }] })
    .mockResolvedValueOnce({ rows: [{ filtered_total: totals.filteredTotal ?? 0 }] })
    .mockResolvedValueOnce({ rows })
  return { db: { drizzle: { execute } } }
}

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, unknown> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

const executedQuery = (payload: MockPayload, index: number): SqlFragment => {
  const call = payload.db.drizzle.execute.mock.calls[index]
  if (!call) throw new Error(`Expected SQL query #${index} to have been executed`)
  return call[0]
}

const filteredTotalQuery = (payload: MockPayload) => executedQuery(payload, 1)
const mapQuery = (payload: MockPayload) => executedQuery(payload, 2)

const runWithQuery = async (query: Record<string, unknown>) => {
  const payload = makePayload()
  await containersWithSignalCount.handler(makeReq(payload, query))
  return payload
}

const filteredParamsFor = async (query: Record<string, unknown>) =>
  sqlParams(filteredTotalQuery(await runWithQuery(query)))

const filteredSqlFor = async (query: Record<string, unknown>) =>
  renderSql(filteredTotalQuery(await runWithQuery(query)))

describe('containersWithSignalCount endpoint (unit)', () => {
  describe('response shape', () => {
    it('returns clusters at the default zoom together with grand and filtered totals', async () => {
      const payload = makePayload([], { total: 120, filteredTotal: 80 })

      const res = await containersWithSignalCount.handler(makeReq(payload))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        type: 'clusters',
        docs: [],
        zoom: 12,
        total: 120,
        filteredTotal: 80,
      })
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(3)
      expect(sqlParams(filteredTotalQuery(payload))).toEqual([])
      expect(sqlParams(mapQuery(payload))).toEqual([0.1])
    })

    it('reports zero totals when the count queries return no rows', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockReset()
      payload.db.drizzle.execute.mockResolvedValue({ rows: [] })

      const res = await containersWithSignalCount.handler(makeReq(payload))

      const body: ClustersBody = await res.json()
      expect(body.total).toBe(0)
      expect(body.filteredTotal).toBe(0)
    })

    it('maps cluster rows, coercing numbers and defaulting missing values', async () => {
      const payload = makePayload([
        {
          lat: '42.69',
          lng: '23.32',
          count: '5',
          dominant_status: 'full',
          active_signal_count: '2',
        },
        { lat: 42.7, lng: 23.3, count: 1, dominant_status: null, active_signal_count: null },
      ])

      const res = await containersWithSignalCount.handler(makeReq(payload))

      const body: ClustersBody = await res.json()
      expect(body.docs).toEqual([
        {
          type: 'cluster',
          lat: 42.69,
          lng: 23.32,
          count: 5,
          dominantStatus: 'full',
          activeSignalCount: 2,
        },
        {
          type: 'cluster',
          lat: 42.7,
          lng: 23.3,
          count: 1,
          dominantStatus: 'active',
          activeSignalCount: 0,
        },
      ])
    })

    it.each([
      ['10', 0.5],
      ['11', 0.25],
      ['12', 0.1],
      ['13', 0.05],
      ['14', 0.02],
      ['15', 0.01],
      ['5', 0.5],
      ['not-a-number', 0.5],
    ])('clusters on the grid for zoom %p with cell size %p', async (zoom, gridSize) => {
      const payload = makePayload()

      const res = await containersWithSignalCount.handler(makeReq(payload, { zoom }))

      const body: ClustersBody = await res.json()
      expect(body.type).toBe('clusters')
      expect(sqlParams(mapQuery(payload))).toEqual([gridSize])
    })

    it('returns individual markers from zoom 16 upwards, capped at 2000 rows', async () => {
      const payload = makePayload([], { total: 3, filteredTotal: 2 })

      const res = await containersWithSignalCount.handler(makeReq(payload, { zoom: '18' }))

      expect(await res.json()).toEqual({
        type: 'markers',
        docs: [],
        zoom: 18,
        total: 3,
        filteredTotal: 2,
      })
      expect(sqlParams(mapQuery(payload))).toEqual([2000])
    })

    it('maps marker rows to camelCase docs', async () => {
      const payload = makePayload([
        {
          id: 7,
          legacy_id: 'L-7',
          public_number: 'SO-007',
          image_id: 3,
          longitude: '23.32',
          latitude: '42.69',
          capacity_size: 'standard',
          capacity_volume: '1.1',
          waste_type: 'general',
          status: 'active',
          serviced_by: 'Acme',
          notes: 'Near the bus stop',
          address: 'Vitosha Blvd 1',
          last_cleaned: '2026-01-02T03:00:00.000Z',
          bin_count: 2,
          district_id: 4,
          source: 'manual',
          state: ['full', 'dirty'],
          collection_days_of_week: ['1', '4'],
          collection_times_per_day: 2,
          schedule_source: 'import',
          created_at: '2025-12-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          signal_count: 3,
          active_signal_count: 1,
        },
        {
          id: 8,
          longitude: 23.3,
          latitude: 42.7,
          capacity_volume: 3,
          state: null,
          collection_days_of_week: null,
          collection_times_per_day: null,
          schedule_source: null,
          signal_count: 0,
          active_signal_count: 0,
        },
      ])

      const res = await containersWithSignalCount.handler(makeReq(payload, { zoom: '16' }))

      const body: MarkersBody = await res.json()
      expect(body.type).toBe('markers')
      expect(body.docs[0]).toEqual({
        type: 'marker',
        id: 7,
        legacyId: 'L-7',
        publicNumber: 'SO-007',
        imageId: 3,
        location: [23.32, 42.69],
        capacitySize: 'standard',
        capacityVolume: 1.1,
        wasteType: 'general',
        status: 'active',
        servicedBy: 'Acme',
        notes: 'Near the bus stop',
        address: 'Vitosha Blvd 1',
        lastCleaned: '2026-01-02T03:00:00.000Z',
        binCount: 2,
        districtId: 4,
        source: 'manual',
        state: ['full', 'dirty'],
        collectionDaysOfWeek: ['1', '4'],
        collectionTimesPerDay: 2,
        scheduleSource: 'import',
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        signalCount: 3,
        activeSignalCount: 1,
      })
      expect(body.docs[1]).toMatchObject({
        id: 8,
        location: [23.3, 42.7],
        capacityVolume: 3,
        state: [],
        collectionDaysOfWeek: [],
        collectionTimesPerDay: null,
        scheduleSource: null,
      })
    })
  })

  describe('viewport bounds', () => {
    it('restricts the map query, but not the filtered total, to the viewport', async () => {
      const payload = await runWithQuery({
        minLat: '42.6',
        maxLat: '42.8',
        minLng: '23.2',
        maxLng: '23.4',
      })

      expect(sqlParams(mapQuery(payload))).toEqual([23.2, 42.6, 23.4, 42.8, 0.1])
      expect(sqlParams(filteredTotalQuery(payload))).toEqual([])
    })

    it('ignores the viewport when any bound is missing or not a number', async () => {
      const missing = await runWithQuery({ minLat: '42.6', maxLat: '42.8', minLng: '23.2' })
      const invalid = await runWithQuery({
        minLat: '42.6',
        maxLat: '42.8',
        minLng: '23.2',
        maxLng: 'east',
      })

      expect(sqlParams(mapQuery(missing))).toEqual([0.1])
      expect(sqlParams(mapQuery(invalid))).toEqual([0.1])
    })
  })

  describe('filters', () => {
    it.each<[string, Record<string, string>, string[]]>([
      ['keeps only known statuses', { statuses: 'active, full,bogus' }, ['active', 'full']],
      ['accepts the legacy status param', { status: 'pending' }, ['pending']],
      ['prefers statuses over status', { statuses: 'inactive', status: 'active' }, ['inactive']],
      ['drops the filter when no status is valid', { statuses: 'bogus' }, []],
    ])('status: %s', async (_name, query, expected) => {
      expect(await filteredParamsFor(query)).toEqual(expected)
    })

    it('keeps only known waste types', async () => {
      expect(await filteredParamsFor({ wasteTypes: 'glass, trashCan,unknown' })).toEqual([
        'glass',
        'trashCan',
      ])
    })

    it('parses volume options as numbers and skips blanks and non-numbers', async () => {
      expect(await filteredParamsFor({ volumeOptions: '1.1, 3.2,,abc' })).toEqual([1.1, 3.2])
    })

    it.each<[string, unknown, number[]]>([
      ['a comma-separated string', '3, 5', [3, 5]],
      ['repeated params', ['3', '5,8'], [3, 5, 8]],
      ['a list with non-numeric ids', '4,abc', [4]],
    ])('district ids: parses %s', async (_name, districtId, expected) => {
      expect(await filteredParamsFor({ districtId })).toEqual(expected)
    })

    // BUG (bugs.md #8): `Number('') === 0`, so blank entries become district 0.
    it.failing.each<[string, unknown, number[]]>([
      ['an empty param', '', []],
      ['a trailing comma', '3,', [3]],
    ])('district ids: skips blank entries in %s', async (_name, districtId, expected) => {
      expect(await filteredParamsFor({ districtId })).toEqual(expected)
    })

    it('filters by zone number and service company when they are integers', async () => {
      expect(await filteredParamsFor({ zoneNumber: '7', serviceCompanyId: '12' })).toEqual([7, 12])
      expect(await filteredParamsFor({ zoneNumber: 'x', serviceCompanyId: 'y' })).toEqual([])
    })

    it('passes created and last-cleaned date ranges through as parameters', async () => {
      expect(
        await filteredParamsFor({
          createdFrom: '2026-01-01',
          createdTo: '2026-02-01',
          lastCleanedFrom: '2026-01-10',
          lastCleanedTo: '2026-01-20',
        })
      ).toEqual(['2026-01-01', '2026-02-01', '2026-01-10', '2026-01-20'])
    })

    it('filters by signal status, container state and age bucket when values are known', async () => {
      expect(
        await filteredParamsFor({
          signalStatus: 'in-progress',
          signalContainerState: 'bulkyWaste',
          signalAgeBucket: '3-7 дни',
        })
      ).toEqual(['in-progress', 'bulkyWaste', '3-7 дни'])
    })

    it('ignores unknown signal status, container state and age bucket values', async () => {
      expect(
        await filteredParamsFor({
          signalStatus: 'open',
          signalContainerState: 'on-fire',
          signalAgeBucket: '30+',
        })
      ).toEqual([])
    })

    it.each<[string, string]>([
      ['hasActiveSignals', 'FROM signals s2'],
      ['lastCleanedIsNull', 'AND wc.last_cleaned IS NULL'],
      ['scheduledToday', 'JOIN waste_containers_collection_days_of_week wcdow'],
    ])('enables the %s filter only for the literal "true"', async (param, clause) => {
      expect(await filteredSqlFor({ [param]: 'true' })).toContain(clause)
      expect(await filteredSqlFor({ [param]: '1' })).toBe(await filteredSqlFor({}))
    })

    it.each<[string, string]>([
      ['onTime', "AND wc.last_cleaned >= NOW() - INTERVAL '24 hours'"],
      [
        'delayed',
        "AND wc.last_cleaned < NOW() - INTERVAL '24 hours' AND wc.last_cleaned >= NOW() - INTERVAL '36 hours'",
      ],
      ['missed', "AND (wc.last_cleaned IS NULL OR wc.last_cleaned < NOW() - INTERVAL '36 hours')"],
    ])('filters schedule category %s', async (scheduleCategory, clause) => {
      expect(await filteredSqlFor({ scheduleCategory })).toContain(clause)
    })

    it('ignores an unknown schedule category', async () => {
      expect(await filteredSqlFor({ scheduleCategory: 'early' })).toBe(await filteredSqlFor({}))
    })

    it('applies the same filters to the filtered total and the map query', async () => {
      const payload = await runWithQuery({
        zoom: '17',
        minLat: '42.6',
        maxLat: '42.8',
        minLng: '23.2',
        maxLng: '23.4',
        statuses: 'active',
        wasteTypes: 'glass',
        districtId: '3',
        volumeOptions: '1.1',
        zoneNumber: '2',
        serviceCompanyId: '9',
        createdFrom: '2026-01-01',
        signalStatus: 'pending',
      })

      const filters = ['active', 'glass', 3, 1.1, 2, 9, '2026-01-01', 'pending']
      expect(sqlParams(filteredTotalQuery(payload))).toEqual(filters)
      expect(sqlParams(mapQuery(payload))).toEqual([23.2, 42.6, 23.4, 42.8, ...filters, 2000])
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

    it('returns 500 with details when a query fails', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockReset()
      payload.db.drizzle.execute.mockRejectedValue(new Error('db down'))

      const res = await containersWithSignalCount.handler(makeReq(payload))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        error: 'Failed to fetch containers with signal counts',
        details: 'db down',
      })
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('reports "Unknown error" when a non-Error is thrown', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockReset()
      payload.db.drizzle.execute.mockRejectedValue('boom')

      const res = await containersWithSignalCount.handler(makeReq(payload, { zoom: '16' }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        error: 'Failed to fetch containers with signal counts',
        details: 'Unknown error',
      })
    })
  })
})
