// Proxy plumbing (env validation, query forwarding, upstream errors/timeouts) is covered in
// oboProxy.test.ts. These tests focus on push-token subscription resolution, the default
// timespan filter and post-processing of the upstream messages.
import type { PayloadRequest } from 'payload'
import type { Category, Subscription } from '@/payload-types'
import { updates } from '../updates'

type FindResult = { totalDocs: number; docs: unknown[] }
type LocationFilter = NonNullable<Subscription['locationFilters']>[number]
type Message = {
  id: string
  text?: string
  categories?: string[]
  pins?: Array<{ address?: string; timespans?: Array<{ start?: string | null }> }>
}
type UpdatesBody = { messages: Message[] } & Record<string, unknown>

const TOKEN = 'ExponentPushToken[abc123]'
const PUSH_TOKEN_ID = 42

const makePayload = () => ({
  find: jest.fn(async (_args: unknown): Promise<FindResult> => ({ totalDocs: 0, docs: [] })),
  logger: { warn: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, unknown> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

const category = (id: number, slug: string | null): Category => ({
  id,
  title: slug ?? `category-${id}`,
  slug,
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
})

const makeSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 7,
  pushToken: PUSH_TOKEN_ID,
  categories: [],
  locationFilters: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const withSubscription = (payload: MockPayload, subscription: Subscription) => {
  payload.find
    .mockResolvedValueOnce({ totalDocs: 1, docs: [{ id: PUSH_TOKEN_ID, token: TOKEN }] })
    .mockResolvedValueOnce({ totalDocs: 1, docs: [subscription] })
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const pointFilter = (latitude: number, longitude: number, radius: number): LocationFilter => ({
  filterType: 'point',
  latitude,
  longitude,
  radius,
})

const areaFilter = (polygon: LocationFilter['polygon']): LocationFilter => ({
  filterType: 'area',
  polygon,
})

describe('updates endpoint (unit)', () => {
  const originalBaseUrl = process.env.OBOAPP_UPDATES_BASE_URL
  const originalApiKey = process.env.OBOAPP_API_KEY
  let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>

  const forwardedParams = (): URLSearchParams => {
    const call = fetchSpy.mock.calls[0]
    if (!call) throw new Error('Expected the upstream API to have been called')
    return new URL(String(call[0])).searchParams
  }

  const forwardedBounds = () => {
    const params = forwardedParams()
    return {
      north: Number(params.get('north')),
      south: Number(params.get('south')),
      east: Number(params.get('east')),
      west: Number(params.get('west')),
    }
  }

  const respondWithMessages = (body: Record<string, unknown>) => {
    fetchSpy.mockImplementation(async () => jsonResponse(body))
  }

  beforeEach(() => {
    process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1'
    process.env.OBOAPP_API_KEY = 'test-api-key'
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => jsonResponse({ messages: [] }))
  })

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
    } else {
      process.env.OBOAPP_UPDATES_BASE_URL = originalBaseUrl
    }

    if (originalApiKey === undefined) {
      Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
    } else {
      process.env.OBOAPP_API_KEY = originalApiKey
    }

    fetchSpy.mockRestore()
    jest.useRealTimers()
  })

  describe('push token subscription', () => {
    it('looks up the token, strips it from the upstream query and ignores unknown tokens', async () => {
      const payload = makePayload()

      const res = await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(res.status).toBe(200)
      expect(payload.find).toHaveBeenCalledTimes(1)
      expect(payload.find).toHaveBeenCalledWith({
        collection: 'push-tokens',
        where: { token: { equals: TOKEN } },
        limit: 1,
      })
      const params = forwardedParams()
      expect(params.has('pushToken')).toBe(false)
      expect(params.has('categories')).toBe(false)
      expect(params.has('north')).toBe(false)
    })

    it('looks up the subscription with populated relations and ignores a missing one', async () => {
      const payload = makePayload()
      payload.find.mockResolvedValueOnce({
        totalDocs: 1,
        docs: [{ id: PUSH_TOKEN_ID, token: TOKEN }],
      })

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(payload.find).toHaveBeenCalledTimes(2)
      expect(payload.find).toHaveBeenLastCalledWith({
        collection: 'subscriptions',
        where: { pushToken: { equals: PUSH_TOKEN_ID } },
        limit: 1,
        depth: 2,
      })
      expect(forwardedParams().has('categories')).toBe(false)
    })

    it('ignores a non-string pushToken without looking it up', async () => {
      const payload = makePayload()

      await updates.handler(makeReq(payload, { pushToken: [TOKEN, 'other'] }))

      expect(payload.find).not.toHaveBeenCalled()
      expect(forwardedParams().has('pushToken')).toBe(false)
    })

    it('forwards the subscribed category slugs when the client sends none', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({
          categories: [category(1, 'water'), 3, category(2, null), category(4, 'traffic')],
        })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(forwardedParams().get('categories')).toBe('water,traffic')
    })

    it('post-filters messages by the subscribed categories', async () => {
      const payload = makePayload()
      withSubscription(payload, makeSubscription({ categories: [category(1, 'water')] }))
      respondWithMessages({
        messages: [
          { id: 'm1', categories: ['water'] },
          { id: 'm2', categories: ['traffic'] },
        ],
      })

      const res = await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      const body: UpdatesBody = await res.json()
      expect(body.messages.map((m) => m.id)).toEqual(['m1'])
    })

    it('keeps client-supplied categories over the subscribed ones', async () => {
      const payload = makePayload()
      withSubscription(payload, makeSubscription({ categories: [category(1, 'water')] }))

      await updates.handler(makeReq(payload, { pushToken: TOKEN, categories: 'electricity' }))

      expect(forwardedParams().get('categories')).toBe('electricity')
    })

    it('derives bounds around a point filter', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({ locationFilters: [pointFilter(42.7, 23.3, 1000)] })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      const bounds = forwardedBounds()
      expect(bounds.north).toBeCloseTo(42.708983, 5)
      expect(bounds.south).toBeCloseTo(42.691017, 5)
      expect(bounds.east).toBeCloseTo(23.312223, 5)
      expect(bounds.west).toBeCloseTo(23.287777, 5)
    })

    it('derives bounds from the extremes of an area polygon', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({
          locationFilters: [
            areaFilter({
              type: 'Polygon',
              coordinates: [
                [
                  [23.2, 42.6],
                  [23.4, 42.6],
                  [23.4, 42.8],
                  [23.25, 42.75],
                  [23.2, 42.6],
                ],
              ],
            }),
          ],
        })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(forwardedBounds()).toEqual({ north: 42.8, south: 42.6, east: 23.4, west: 23.2 })
    })

    it('unions the bounds of all usable filters and skips unusable ones', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({
          locationFilters: [
            pointFilter(42.6, 23.3, 1000),
            areaFilter({
              type: 'Polygon',
              coordinates: [
                [
                  [23.35, 42.65],
                  [23.45, 42.65],
                  [23.45, 42.75],
                  [23.35, 42.75],
                  [23.35, 42.65],
                ],
              ],
            }),
            // Unusable filters that must not widen the box:
            pointFilter(40, 20, 0),
            { filterType: 'point', latitude: null, longitude: 10, radius: 5000 },
            areaFilter(null),
            areaFilter({ type: 'Polygon', coordinates: [] }),
            areaFilter({ type: 'Point', coordinates: [10, 10] }),
            { filterType: 'district', district: 3 },
          ],
        })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      const bounds = forwardedBounds()
      expect(bounds.north).toBe(42.75)
      expect(bounds.south).toBeCloseTo(42.591017, 5)
      expect(bounds.east).toBe(23.45)
      expect(bounds.west).toBeCloseTo(23.287796, 5)
      expect(payload.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('District location filter cannot be converted to bounds')
      )
    })

    it('applies no bounds when only district filters are configured', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({ locationFilters: [{ filterType: 'district', district: 3 }] })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(forwardedParams().has('north')).toBe(false)
    })

    it('applies no bounds when any filter is "all", but still applies categories', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({
          categories: [category(1, 'water')],
          locationFilters: [pointFilter(42.7, 23.3, 1000), { filterType: 'all' }],
        })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      const params = forwardedParams()
      expect(params.has('north')).toBe(false)
      expect(params.get('categories')).toBe('water')
    })

    it('does not override bounds supplied by the client', async () => {
      const payload = makePayload()
      withSubscription(
        payload,
        makeSubscription({ locationFilters: [pointFilter(42.7, 23.3, 1000)] })
      )

      await updates.handler(makeReq(payload, { pushToken: TOKEN, north: '43' }))

      const params = forwardedParams()
      expect(params.get('north')).toBe('43')
      expect(params.has('south')).toBe(false)
      expect(params.has('east')).toBe(false)
      expect(params.has('west')).toBe(false)
    })

    it('logs and falls back to an unfiltered request when the lookup fails', async () => {
      const payload = makePayload()
      const err = new Error('db down')
      payload.find.mockRejectedValue(err)

      const res = await updates.handler(makeReq(payload, { pushToken: TOKEN }))

      expect(res.status).toBe(200)
      expect(payload.logger.error).toHaveBeenCalledWith(
        { err },
        expect.stringContaining('Failed to resolve subscription')
      )
      const params = forwardedParams()
      expect(params.has('pushToken')).toBe(false)
      expect(params.has('categories')).toBe(false)
    })
  })

  describe('default timespan filter', () => {
    it.each<[string, Record<string, unknown>]>([
      ['missing', {}],
      ['null', { timespanEndGte: null }],
    ])('uses the start of the current local day when timespanEndGte is %s', async (_n, query) => {
      const now = new Date('2026-06-15T12:00:00.000Z')
      jest.useFakeTimers({ now })
      const startOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      await updates.handler(makeReq(makePayload(), query))

      expect(forwardedParams().get('timespanEndGte')).toBe(startOfLocalDay.toISOString())
    })
  })

  describe('post-processing of upstream messages', () => {
    it('drops messages that have a pin timespan without a start', async () => {
      const payload = makePayload()
      const longText = 'x'.repeat(200)
      respondWithMessages({
        meta: { source: 'oboapp' },
        messages: [
          { id: 'm1', pins: [{ timespans: [{ start: '2026-06-15T08:00:00.000Z' }] }] },
          {
            id: 'm2',
            text: longText,
            pins: [{ timespans: [{ start: '2026-06-15T08:00:00.000Z' }, { start: null }] }],
          },
          { id: 'm3', pins: [{ address: 'Vitosha 1' }, { timespans: [{}] }] },
          { id: 'm4' },
          { id: 'm5', pins: [{ address: 'Vitosha 2' }] },
        ],
      })

      const res = await updates.handler(makeReq(payload))

      expect(res.status).toBe(200)
      const body: UpdatesBody = await res.json()
      expect(body.meta).toEqual({ source: 'oboapp' })
      expect(body.messages.map((m) => m.id)).toEqual(['m1', 'm4', 'm5'])
      expect(payload.logger.warn).toHaveBeenCalledTimes(2)
      expect(payload.logger.warn).toHaveBeenCalledWith(
        { messageId: 'm2', text: longText.slice(0, 120) },
        expect.stringContaining('Dropping message')
      )
      expect(payload.logger.warn).toHaveBeenCalledWith(
        { messageId: 'm3', text: undefined },
        expect.stringContaining('Dropping message')
      )
    })

    it('filters messages by the requested categories, case-insensitively', async () => {
      respondWithMessages({
        messages: [
          { id: 'm1', categories: ['water'] },
          { id: 'm2', categories: ['Traffic', 'other'] },
          { id: 'm3', categories: ['electricity'] },
          { id: 'm4' },
          { id: 'm5', categories: [] },
        ],
      })

      const res = await updates.handler(makeReq(makePayload(), { categories: ' Water, ,TRAFFIC ' }))

      const body: UpdatesBody = await res.json()
      expect(body.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    })

    it('does not filter by category when the categories param is blank', async () => {
      respondWithMessages({
        messages: [{ id: 'm1', categories: ['water'] }, { id: 'm2' }],
      })

      const res = await updates.handler(makeReq(makePayload(), { categories: '   ' }))

      const body: UpdatesBody = await res.json()
      expect(body.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    })

    // BUG (bugs.md #5): the post-filter only handles a single `categories` string, so a repeated
    // param comes back unfiltered.
    it.failing('filters messages by every value of a repeated categories param', async () => {
      respondWithMessages({
        messages: [
          { id: 'm1', categories: ['water'] },
          { id: 'm2', categories: ['traffic'] },
          { id: 'm3', categories: ['electricity'] },
        ],
      })

      const res = await updates.handler(
        makeReq(makePayload(), { categories: ['water', 'traffic'] })
      )

      const body: UpdatesBody = await res.json()
      expect(body.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    })

    // BUG (bugs.md #4): `.json()` reads the body before post-processing; when that fails, the
    // already-read response is returned and the client can't read it.
    it.failing('passes a non-JSON upstream body through readable', async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response('<html>maintenance</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
      )

      const res = await updates.handler(makeReq(makePayload()))

      await expect(res.text()).resolves.toBe('<html>maintenance</html>')
    })
  })
})
