jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}))

// expo-server-sdk ships as ESM only; only the static token validator is used here.
jest.mock('expo-server-sdk', () => ({
  Expo: {
    isExpoPushToken: (token: unknown): boolean =>
      typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token),
  },
}))

import type { Payload } from 'payload'
import { matchSubscriptions } from '../matchSubscriptions'

type Ref = { id: number } | number
type LocationFilter = {
  filterType: string
  district?: Ref | null
  latitude?: number | null
  longitude?: number | null
  radius?: number | null
  polygon?: unknown
}
type PushTokenRef = { id: number; token: string; active?: boolean | null } | number | string | null
type SubscriptionDoc = {
  id: number
  pushToken: PushTokenRef
  locationFilters?: LocationFilter[] | null
}
type SqlFragment = { strings: readonly string[]; values: unknown[] }
type GeoResult = { rows: { match: boolean }[] }
type News = Parameters<typeof matchSubscriptions>[1]

const NEWS_LAT = 42.6977
const NEWS_LNG = 23.3219

const makePayload = (pages: SubscriptionDoc[][] = [[]]) => ({
  find: jest.fn(async ({ page }: { page: number }) => ({
    docs: pages[page - 1] ?? [],
    hasNextPage: page < pages.length,
  })),
  db: {
    drizzle: {
      execute: jest.fn(async (_query: SqlFragment): Promise<GeoResult> => ({
        rows: [{ match: false }],
      })),
    },
  },
  logger: { warn: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const run = (payload: MockPayload, news: News) =>
  matchSubscriptions(payload as unknown as Payload, news)

const token = (suffix: string | number) => `ExponentPushToken[${suffix}]`

const subscription = (
  id: number,
  locationFilters?: LocationFilter[] | null,
  pushToken: PushTokenRef = { id: 100 + id, token: token(id) }
): SubscriptionDoc => ({ id, pushToken, locationFilters })

const newsItem = (overrides: Partial<News> = {}): News => ({
  id: 1,
  categories: [{ id: 3 }],
  district: null,
  location: { latitude: NEWS_LAT, longitude: NEWS_LNG },
  ...overrides,
})

const geoMatch = (match: boolean): GeoResult => ({ rows: [{ match }] })

const executedValues = (payload: MockPayload): unknown[][] =>
  payload.db.drizzle.execute.mock.calls.map(([query]) => query.values)

const pointFilter = (overrides: Partial<LocationFilter> = {}): LocationFilter => ({
  filterType: 'point',
  latitude: 42.69,
  longitude: 23.31,
  radius: 500,
  ...overrides,
})

const polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [23.3, 42.68],
      [23.34, 42.68],
      [23.34, 42.71],
      [23.3, 42.71],
      [23.3, 42.68],
    ],
  ],
}

describe('matchSubscriptions (unit)', () => {
  it('returns no tokens without querying when the news has no categories', async () => {
    for (const categories of [undefined, null, []]) {
      const payload = makePayload([[subscription(1)]])

      await expect(run(payload, newsItem({ categories }))).resolves.toEqual([])
      expect(payload.find).not.toHaveBeenCalled()
    }
  })

  it('queries enabled subscriptions for any of the news categories', async () => {
    const payload = makePayload()

    await run(payload, newsItem({ categories: [{ id: 3 }, 7, '9'] }))

    expect(payload.find).toHaveBeenCalledTimes(1)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'subscriptions',
        where: {
          'categories.id': { in: ['3', '7', '9'] },
          enabled: { equals: true },
        },
        depth: 1,
        page: 1,
      })
    )
  })

  it('collects matches across all result pages', async () => {
    const payload = makePayload([[subscription(1)], [subscription(2)], [subscription(3)]])

    await expect(run(payload, newsItem())).resolves.toEqual([token(1), token(2), token(3)])

    expect(payload.find.mock.calls.map(([args]) => args.page)).toEqual([1, 2, 3])
  })

  it('skips subscriptions without a usable active push token and returns each token once', async () => {
    const payload = makePayload([
      [
        subscription(1),
        subscription(2, [], { id: 1, token: token(1) }),
        subscription(3, [], null),
        subscription(4, [], 104),
        subscription(5, [], '105'),
        subscription(6, [], { id: 106, token: '' }),
        subscription(7, [], { id: 107, token: 'not-an-expo-token' }),
        subscription(8, [], { id: 108, token: token(8), active: false }),
        subscription(9, [], { id: 109, token: token(9), active: null }),
      ],
    ])

    await expect(run(payload, newsItem())).resolves.toEqual([token(1), token(9)])
  })

  it('matches subscriptions without location filters regardless of the news location', async () => {
    const payload = makePayload([[subscription(1), subscription(2, null), subscription(3, [])]])

    const tokens = await run(payload, newsItem({ district: null, location: null }))

    expect(tokens).toEqual([token(1), token(2), token(3)])
  })

  it('matches an "all" location filter regardless of the news location', async () => {
    const payload = makePayload([[subscription(1, [{ filterType: 'all' }])]])

    await expect(run(payload, newsItem({ location: null }))).resolves.toEqual([token(1)])
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  it('matches district filters against the news district', async () => {
    const payload = makePayload([
      [
        subscription(1, [{ filterType: 'district', district: 5 }]),
        subscription(2, [{ filterType: 'district', district: { id: 5 } }]),
        subscription(3, [{ filterType: 'district', district: 6 }]),
        subscription(4, [{ filterType: 'district', district: null }]),
        subscription(5, [
          { filterType: 'district', district: 6 },
          { filterType: 'district', district: 5 },
        ]),
      ],
    ])

    const tokens = await run(payload, newsItem({ district: { id: 5 }, location: null }))

    expect(tokens).toEqual([token(1), token(2), token(5)])
  })

  it('does not match district filters when the news has no district', async () => {
    const payload = makePayload([[subscription(1, [{ filterType: 'district', district: 5 }])]])

    await expect(run(payload, newsItem({ district: null }))).resolves.toEqual([])
  })

  it('ignores unknown location filter types', async () => {
    const payload = makePayload([[subscription(1, [{ filterType: 'neighbourhood' }])]])

    await expect(run(payload, newsItem())).resolves.toEqual([])
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  it('does not run geo checks when an in-process filter already matched', async () => {
    const payload = makePayload([
      [subscription(1, [pointFilter(), { filterType: 'district', district: 5 }])],
    ])

    await expect(run(payload, newsItem({ district: 5 }))).resolves.toEqual([token(1)])
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  describe('point filters', () => {
    it('matches when PostGIS reports the news within the radius', async () => {
      const payload = makePayload([[subscription(1, [pointFilter()])]])
      payload.db.drizzle.execute.mockResolvedValueOnce(geoMatch(true))

      await expect(run(payload, newsItem())).resolves.toEqual([token(1)])
      expect(executedValues(payload)).toEqual([[NEWS_LNG, NEWS_LAT, 23.31, 42.69, 500]])
    })

    it('does not match when PostGIS reports the news outside the radius', async () => {
      const payload = makePayload([
        [subscription(1, [pointFilter()]), subscription(2, [pointFilter()])],
      ])
      payload.db.drizzle.execute
        .mockResolvedValueOnce(geoMatch(false))
        .mockResolvedValueOnce({ rows: [] })

      await expect(run(payload, newsItem())).resolves.toEqual([])
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
    })

    it('skips filters with an incomplete center or radius', async () => {
      const payload = makePayload([
        [
          subscription(1, [
            pointFilter({ latitude: null }),
            pointFilter({ longitude: Number.NaN }),
            pointFilter({ radius: null }),
            pointFilter({ radius: 0 }),
          ]),
        ],
      ])

      await expect(run(payload, newsItem())).resolves.toEqual([])
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    })

    it('stops checking further geo filters once one matched', async () => {
      const payload = makePayload([
        [
          subscription(1, [
            pointFilter(),
            pointFilter({ radius: 1000 }),
            { filterType: 'area', polygon },
          ]),
        ],
      ])
      payload.db.drizzle.execute.mockResolvedValueOnce(geoMatch(true))

      await expect(run(payload, newsItem())).resolves.toEqual([token(1)])
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(1)
    })

    it('logs a failed check and continues with the remaining filters', async () => {
      const payload = makePayload([
        [subscription(1, [pointFilter(), pointFilter({ radius: 1000 })])],
      ])
      payload.db.drizzle.execute
        .mockRejectedValueOnce(new Error('postgis unavailable'))
        .mockResolvedValueOnce(geoMatch(true))

      await expect(run(payload, newsItem())).resolves.toEqual([token(1)])
      expect(payload.logger.warn).toHaveBeenCalledWith(
        'PostGIS point check failed: Error: postgis unavailable'
      )
    })
  })

  describe('area filters', () => {
    it('matches when PostGIS reports the polygon contains the news location', async () => {
      const payload = makePayload([[subscription(1, [{ filterType: 'area', polygon }])]])
      payload.db.drizzle.execute.mockResolvedValueOnce(geoMatch(true))

      await expect(run(payload, newsItem())).resolves.toEqual([token(1)])
      expect(executedValues(payload)).toEqual([[JSON.stringify(polygon), NEWS_LNG, NEWS_LAT]])
    })

    it('is checked after non-matching point filters', async () => {
      const payload = makePayload([
        [subscription(1, [pointFilter(), { filterType: 'area', polygon }])],
      ])
      payload.db.drizzle.execute
        .mockResolvedValueOnce(geoMatch(false))
        .mockResolvedValueOnce(geoMatch(true))

      await expect(run(payload, newsItem())).resolves.toEqual([token(1)])
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
    })

    it('does not match when the polygon does not contain the news location', async () => {
      const payload = makePayload([[subscription(1, [{ filterType: 'area', polygon }])]])

      await expect(run(payload, newsItem())).resolves.toEqual([])
      expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(1)
    })

    it('skips filters without a polygon', async () => {
      const payload = makePayload([[subscription(1, [{ filterType: 'area', polygon: null }])]])

      await expect(run(payload, newsItem())).resolves.toEqual([])
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    })

    it('logs a failed check and treats it as no match', async () => {
      const payload = makePayload([[subscription(1, [{ filterType: 'area', polygon }])]])
      payload.db.drizzle.execute.mockRejectedValueOnce(new Error('invalid GeoJSON'))

      await expect(run(payload, newsItem())).resolves.toEqual([])
      expect(payload.logger.warn).toHaveBeenCalledWith(
        'PostGIS area check failed: Error: invalid GeoJSON'
      )
    })

    // BUG (bugs.md #1): ST_GeomFromGeoJSON returns SRID 4326 but ST_MakePoint has SRID 0, so
    // PostGIS rejects ST_Contains with "Operation on mixed SRID geometries".
    it.failing('builds the news point in the polygon SRID (4326)', async () => {
      const payload = makePayload([[subscription(1, [{ filterType: 'area', polygon }])]])

      await run(payload, newsItem())

      const [query] = payload.db.drizzle.execute.mock.calls[0]!
      expect([...query.strings, ...query.values.map(String)].join(' ')).toContain('4326')
    })
  })

  it('skips geo checks when the news has no coordinates', async () => {
    const filters: LocationFilter[] = [pointFilter(), { filterType: 'area', polygon }]
    const locations: News['location'][] = [
      null,
      undefined,
      { latitude: null, longitude: NEWS_LNG },
      { latitude: NEWS_LAT, longitude: null },
    ]

    for (const location of locations) {
      const payload = makePayload([[subscription(1, filters)]])

      await expect(run(payload, newsItem({ location }))).resolves.toEqual([])
      expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
    }
  })
})
