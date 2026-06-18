import { updates } from '../updates'
import { updatesById } from '../updatesById'
import { updatesOpenApi } from '../updatesOpenApi'
import { updatesSources } from '../updatesSources'
import type { UpdateMessage } from '../../lib/oboMessageMapper'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<UpdateMessage> = {}): UpdateMessage {
  return {
    id: 'msg-1',
    text: 'Test message',
    createdAt: '2026-01-01T00:00:00.000Z',
    finalizedAt: '2026-01-01T02:00:00.000Z',
    timespanStart: '2026-01-01T00:00:00.000Z',
    timespanEnd: '2026-01-10T00:00:00.000Z',
    locality: 'bg.sofia',
    categories: ['water'],
    cityWide: false,
    ...overrides,
  }
}

/**
 * Build a fake Payload request whose `payload.find` resolves to the given
 * cache rows ({ data: UpdateMessage }). A custom `find` implementation can be
 * supplied for error cases or to inspect query args.
 */
function makeReq(
  options: {
    query?: Record<string, unknown>
    url?: string
    docs?: { data: UpdateMessage }[]
    find?: jest.Mock
  } = {}
) {
  const find = options.find ?? jest.fn().mockResolvedValue({ docs: options.docs ?? [] })
  return {
    query: options.query ?? {},
    url: options.url,
    payload: { find, logger: { warn: jest.fn(), error: jest.fn() } },
    _find: find,
  } as any
}

// ─── updates endpoint ──────────────────────────────────────────────────────

describe('updates endpoint (unit)', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 200 with messages from the cache', async () => {
    const req = makeReq({ docs: [{ data: makeMsg() }] })
    const res = await updates.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].id).toBe('msg-1')
    expect(body.pagination).toEqual({ limit: 200, offset: 0, total: 1 })
  })

  it('queries the cache by locality and active-timespan cutoff', async () => {
    const req = makeReq()
    await updates.handler(req)
    const arg = req._find.mock.calls[0][0]
    expect(arg.collection).toBe('obo-updates')
    expect(arg.where.locality).toEqual({ equals: 'bg.sofia' })
    expect(arg.where.timespanEnd.greater_than_equal).toBeDefined()
    expect(arg.overrideAccess).toBe(true)
    expect(arg.pagination).toBe(false)
  })

  it('defaults the timespan cutoff to the start of today when not provided', async () => {
    const req = makeReq()
    await updates.handler(req)
    const cutoff = new Date(req._find.mock.calls[0][0].where.timespanEnd.greater_than_equal)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    expect(cutoff.getTime()).toBe(todayStart.getTime())
  })

  it('preserves a provided timespanEndGte', async () => {
    const req = makeReq({ query: { timespanEndGte: '2026-02-23T00:00:00.000Z' } })
    await updates.handler(req)
    expect(req._find.mock.calls[0][0].where.timespanEnd.greater_than_equal).toBe(
      '2026-02-23T00:00:00.000Z'
    )
  })

  it('filters by categories in JS (and always keeps cityWide)', async () => {
    const req = makeReq({
      query: { categories: 'traffic' },
      docs: [
        { data: makeMsg({ id: 'water', categories: ['water'] }) },
        { data: makeMsg({ id: 'traffic', categories: ['traffic'] }) },
        { data: makeMsg({ id: 'cw', categories: ['water'], cityWide: true }) },
      ],
    })
    const res = await updates.handler(req)
    const ids = (await res.json()).messages.map((m: { id: string }) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['traffic', 'cw']))
    expect(ids).not.toContain('water')
  })

  it('drops messages that have pins with null timespans.start', async () => {
    const req = makeReq({
      docs: [
        { data: makeMsg({ id: 'good', pins: [] }) },
        {
          data: makeMsg({
            id: 'bad',
            pins: [
              { address: 'Test', timespans: [{ start: null, end: '2026-01-10T00:00:00.000Z' }] },
            ],
          }),
        },
      ],
    })
    const res = await updates.handler(req)
    const ids = (await res.json()).messages.map((m: { id: string }) => m.id)
    expect(ids).toEqual(['good'])
  })

  it('applies the viewport bounds filter in-memory', async () => {
    const inBounds = makeMsg({
      id: 'in',
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [23.3, 42.7] },
            properties: {},
          },
        ],
      },
    })
    const outOfBounds = makeMsg({
      id: 'out',
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [24.0, 43.5] },
            properties: {},
          },
        ],
      },
    })
    const req = makeReq({
      query: { north: '43.0', south: '42.5', east: '23.5', west: '23.0' },
      docs: [{ data: inBounds }, { data: outOfBounds }],
    })
    const res = await updates.handler(req)
    const ids = (await res.json()).messages.map((m: { id: string }) => m.id)
    expect(ids).toEqual(['in'])
  })

  it('always includes cityWide messages when a bounds filter is active', async () => {
    const cityWide = makeMsg({ id: 'cw', cityWide: true, geoJson: undefined })
    const elsewhere = makeMsg({
      id: 'normal',
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [30.0, 50.0] },
            properties: {},
          },
        ],
      },
    })
    const req = makeReq({
      query: { north: '43.0', south: '42.5', east: '23.5', west: '23.0' },
      docs: [{ data: cityWide }, { data: elsewhere }],
    })
    const res = await updates.handler(req)
    const ids = (await res.json()).messages.map((m: { id: string }) => m.id)
    expect(ids).toContain('cw')
    expect(ids).not.toContain('normal')
  })

  it('paginates in-memory after filtering', async () => {
    const docs = [
      { data: makeMsg({ id: 'a', finalizedAt: '2026-01-05T00:00:00.000Z' }) },
      { data: makeMsg({ id: 'b', finalizedAt: '2026-01-04T00:00:00.000Z' }) },
      { data: makeMsg({ id: 'c', finalizedAt: '2026-01-03T00:00:00.000Z' }) },
    ]
    const req = makeReq({ query: { limit: '1', offset: '1' }, docs })
    const res = await updates.handler(req)
    const body = await res.json()
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual(['b'])
    expect(body.pagination).toEqual({ limit: 1, offset: 1, total: 3 })
  })

  it('caps the requested limit to the hard maximum', async () => {
    const req = makeReq({ query: { limit: '9999' }, docs: [{ data: makeMsg() }] })
    const res = await updates.handler(req)
    expect((await res.json()).pagination.limit).toBe(500)
  })

  it('does not call fetch (served from the local cache)', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn()
    await updates.handler(makeReq())
    expect(global.fetch).not.toHaveBeenCalled()
    global.fetch = originalFetch
  })

  it.each([
    [{ limit: '-1' }, 'Invalid limit value'],
    [{ offset: '-1' }, 'Invalid offset value'],
    [{ timespanEndGte: 'not-a-date' }, 'Invalid timespanEndGte value'],
  ])('returns 400 for invalid query %o', async (query, error) => {
    const res = await updates.handler(makeReq({ query }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error })
  })

  it('returns 500 when the cache query fails', async () => {
    const find = jest.fn().mockRejectedValue(new Error('db down'))
    const res = await updates.handler(makeReq({ find }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to query updates' })
  })
})

// ─── updatesById endpoint ──────────────────────────────────────────────────

describe('updatesById endpoint (unit)', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns 400 when id is missing', async () => {
    const res = await updatesById.handler(makeReq())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing required query parameter: id' })
  })

  it.each([
    ['', 'empty string'],
    ['   ', 'whitespace-only string'],
  ])('returns 400 when id is %s', async (id) => {
    const res = await updatesById.handler(makeReq({ query: { id } }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with the message when found', async () => {
    const req = makeReq({ query: { id: 'msg-1' }, docs: [{ data: makeMsg({ id: 'msg-1' }) }] })
    const res = await updatesById.handler(req)
    expect(res.status).toBe(200)
    expect((await res.json()).message.id).toBe('msg-1')
  })

  it('returns 404 when not found', async () => {
    const req = makeReq({ query: { id: 'missing' }, docs: [] })
    const res = await updatesById.handler(req)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Message not found' })
  })

  it('trims whitespace and queries by oboId + locality', async () => {
    const req = makeReq({ query: { id: '  msg-1  ' }, docs: [{ data: makeMsg() }] })
    await updatesById.handler(req)
    const arg = req._find.mock.calls[0][0]
    expect(arg.collection).toBe('obo-updates')
    expect(arg.where.oboId).toEqual({ equals: 'msg-1' })
    expect(arg.where.locality).toEqual({ equals: 'bg.sofia' })
  })

  it('accepts array id values by using the first valid entry', async () => {
    const req = makeReq({ query: { id: ['msg-1'] }, docs: [{ data: makeMsg() }] })
    const res = await updatesById.handler(req)
    expect(res.status).toBe(200)
    expect(req._find.mock.calls[0][0].where.oboId).toEqual({ equals: 'msg-1' })
  })

  it('extracts a loose id from the raw URL when query parsing is incomplete', async () => {
    const rawId = 'aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1'
    const req = makeReq({ url: `/api/updates/by-id?id=${rawId}`, docs: [{ data: makeMsg() }] })
    const res = await updatesById.handler(req)
    expect(res.status).toBe(200)
    expect(req._find.mock.calls[0][0].where.oboId).toEqual({ equals: rawId })
  })

  it('returns 500 when the cache query fails', async () => {
    const find = jest.fn().mockRejectedValue(new Error('db down'))
    const res = await updatesById.handler(makeReq({ query: { id: 'msg-1' }, find }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to query updates' })
  })
})

// ─── updatesOpenApi endpoint ───────────────────────────────────────────────

describe('updates openapi endpoint (unit)', () => {
  it('returns schema with expected public paths', async () => {
    const res = await updatesOpenApi.handler({} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('openapi', '3.1.0')
    expect(body.paths).toHaveProperty('/api/updates')
    expect(body.paths).toHaveProperty('/api/updates/by-id')
    expect(body.paths).toHaveProperty('/api/updates/sources')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('400')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('500')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('400')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('404')
  })
})

// ─── updatesSources endpoint (still proxies the OBO REST API) ───────────────

describe('updatesSources endpoint (unit)', () => {
  const originalBaseUrl = process.env.OBOAPP_UPDATES_BASE_URL
  const originalApiKey = process.env.OBOAPP_API_KEY
  const originalNodeEnv = process.env.NODE_ENV
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1'
    process.env.OBOAPP_API_KEY = 'test-api-key'
    Reflect.set(process.env, 'NODE_ENV', 'test')
    global.fetch = jest.fn()
  })

  afterEach(() => {
    if (originalBaseUrl === undefined)
      Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
    else process.env.OBOAPP_UPDATES_BASE_URL = originalBaseUrl
    if (originalApiKey === undefined) Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
    else process.env.OBOAPP_API_KEY = originalApiKey
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
    else Reflect.set(process.env, 'NODE_ENV', originalNodeEnv)
    global.fetch = originalFetch
  })

  it('proxies updates sources metadata', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ sources: [{ id: 'sofia-bg', name: 'Столична община' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const res = await updatesSources.handler({ query: {} } as any)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/sources')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sources: [{ id: 'sofia-bg', name: 'Столична община' }] })
  })

  it('returns 500 when OBOAPP_UPDATES_BASE_URL is missing', async () => {
    Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
    const res = await updatesSources.handler({ query: {} } as any)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'OBOAPP_UPDATES_BASE_URL is not configured' })
  })
})
