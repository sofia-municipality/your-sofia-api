import { updates } from '../updates'
import { updatesById } from '../updatesById'
import { updatesOpenApi } from '../updatesOpenApi'
import { updatesSources } from '../updatesSources'

// ─── Mock oboMongo ────────────────────────────────────────────────────────

jest.mock('../../lib/oboMongo', () => ({
  getMessagesCollection: jest.fn(),
  getSourcesCollection: jest.fn(),
  isMongoConfigured: jest.fn(() => true),
  SOFIA_LOCALITY: 'bg.sofia',
}))

import { getMessagesCollection } from '../../lib/oboMongo'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'msg-1',
    text: 'Test message',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    crawledAt: new Date('2026-01-01T01:00:00.000Z'),
    finalizedAt: new Date('2026-01-01T02:00:00.000Z'),
    timespanStart: new Date('2026-01-01T00:00:00.000Z'),
    timespanEnd: new Date('2026-01-10T00:00:00.000Z'),
    locality: 'bg.sofia',
    categories: ['water'],
    cityWide: false,
    ...overrides,
  }
}

function mockCollection(
  docs: Record<string, unknown>[],
  findOneResult: Record<string, unknown> | null = null
) {
  const cursor = {
    sort: jest.fn().mockReturnThis(),
    project: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(docs),
  }
  return {
    find: jest.fn().mockReturnValue(cursor),
    findOne: jest.fn().mockResolvedValue(findOneResult),
  }
}

// ─── updates endpoint ─────────────────────────────────────────────────────

describe('updates endpoint (unit)', () => {
  const originalUri = process.env.YSM_OBOAPP_MONGODB_URI

  beforeEach(() => {
    process.env.YSM_OBOAPP_MONGODB_URI = 'mongodb://localhost:27017'
  })

  afterEach(() => {
    if (originalUri === undefined) {
      Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    } else {
      process.env.YSM_OBOAPP_MONGODB_URI = originalUri
    }
    jest.clearAllMocks()
  })

  it('returns 500 when YSM_OBOAPP_MONGODB_URI is not configured', async () => {
    Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    const res = await updates.handler({ query: {} } as any)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' })
  })

  it('returns 500 when Mongo connection fails', async () => {
    ;(getMessagesCollection as jest.Mock).mockRejectedValue(new Error('connect failed'))
    const res = await updates.handler({
      query: {},
      payload: { logger: { error: jest.fn() } },
    } as any)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to connect to OboApp database' })
  })

  it('returns 200 with mapped messages', async () => {
    const doc = makeMessage()
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(mockCollection([doc]))
    const res = await updates.handler({ query: {} } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].id).toBe('msg-1')
    expect(body.messages[0].text).toBe('Test message')
  })

  it('adds default timespanEndGte filter when missing', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: {} } as any)
    const filterArg = col.find.mock.calls[0][0]
    expect(filterArg.timespanEnd).toBeDefined()
    expect(filterArg.timespanEnd.$gte).toBeInstanceOf(Date)
  })

  it('preserves provided timespanEndGte filter', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: { timespanEndGte: '2026-02-23T00:00:00.000Z' } } as any)
    const filterArg = col.find.mock.calls[0][0]
    expect(filterArg.timespanEnd.$gte).toEqual(new Date('2026-02-23T00:00:00.000Z'))
  })

  it('applies categories $in filter when categories are given', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: { categories: 'water,traffic' } } as any)
    const filterArg = col.find.mock.calls[0][0]
    expect(filterArg.$or).toBeDefined()
    const catClause = filterArg.$or.find((c: Record<string, unknown>) => c.categories)
    expect(catClause.categories.$in).toEqual(expect.arrayContaining(['water', 'traffic']))
    const cityWideClause = filterArg.$or.find((c: Record<string, unknown>) => c.cityWide)
    expect(cityWideClause.cityWide).toBe(true)
  })

  it('does not include $or filter when no categories are given', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: {} } as any)
    const filterArg = col.find.mock.calls[0][0]
    expect(filterArg.$or).toBeUndefined()
  })

  it('drops messages that have pins with null timespans.start', async () => {
    const goodDoc = makeMessage({ _id: 'good', pins: [] })
    const badDoc = makeMessage({
      _id: 'bad',
      pins: [{ address: 'Test', timespans: [{ start: null, end: '2026-01-10T00:00:00.000Z' }] }],
    })
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(mockCollection([goodDoc, badDoc]))
    const res = await updates.handler({
      query: {},
      payload: { logger: { warn: jest.fn(), error: jest.fn() } },
    } as any)
    const body = await res.json()
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual(['good'])
  })

  it('applies viewport bounds filter in-memory', async () => {
    const inBoundsDoc = makeMessage({
      _id: 'in',
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
    const outOfBoundsDoc = makeMessage({
      _id: 'out',
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
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(
      mockCollection([inBoundsDoc, outOfBoundsDoc])
    )
    const res = await updates.handler({
      query: { north: '43.0', south: '42.5', east: '23.5', west: '23.0' },
    } as any)
    const body = await res.json()
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual(['in'])
  })

  it('always includes cityWide messages when bounds filter is active', async () => {
    const cityWideDoc = makeMessage({ _id: 'cw', cityWide: true, geoJson: undefined })
    const normalDoc = makeMessage({
      _id: 'normal',
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
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(
      mockCollection([cityWideDoc, normalDoc])
    )
    const res = await updates.handler({
      query: { north: '43.0', south: '42.5', east: '23.5', west: '23.0' },
    } as any)
    const body = await res.json()
    expect(body.messages.map((m: { id: string }) => m.id)).toContain('cw')
    expect(body.messages.map((m: { id: string }) => m.id)).not.toContain('normal')
  })

  it('does not call fetch (no upstream proxy)', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn()
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(mockCollection([]))
    await updates.handler({ query: {} } as any)
    expect(global.fetch).not.toHaveBeenCalled()
    global.fetch = originalFetch
  })

  it('applies default pagination when limit/offset are not provided', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: {} } as any)
    expect(col.find).toHaveBeenCalledTimes(1)
    const cursor = col.find.mock.results[0]!.value
    expect(cursor.skip).toHaveBeenCalledWith(0)
    expect(cursor.limit).toHaveBeenCalledWith(200)
  })

  it('caps requested limit to hard maximum', async () => {
    const col = mockCollection([])
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updates.handler({ query: { limit: '9999' } } as any)
    expect(col.find).toHaveBeenCalledTimes(1)
    const cursor = col.find.mock.results[0]!.value
    expect(cursor.limit).toHaveBeenCalledWith(500)
  })

  it('returns 400 for invalid limit', async () => {
    const res = await updates.handler({ query: { limit: '-1' } } as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid limit value' })
  })
})

// ─── updatesById endpoint ─────────────────────────────────────────────────

describe('updatesById endpoint (unit)', () => {
  const originalUri = process.env.YSM_OBOAPP_MONGODB_URI

  beforeEach(() => {
    process.env.YSM_OBOAPP_MONGODB_URI = 'mongodb://localhost:27017'
  })

  afterEach(() => {
    if (originalUri === undefined) {
      Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    } else {
      process.env.YSM_OBOAPP_MONGODB_URI = originalUri
    }
    jest.clearAllMocks()
  })

  it('returns 400 when id is missing', async () => {
    const res = await updatesById.handler({ query: {} } as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing required query parameter: id' })
  })

  it.each([
    ['', 'empty string'],
    ['   ', 'whitespace-only string'],
  ])('returns 400 when id is %s', async (id) => {
    const res = await updatesById.handler({ query: { id } } as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing required query parameter: id' })
  })

  it('returns 500 when YSM_OBOAPP_MONGODB_URI is not configured', async () => {
    Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    const res = await updatesById.handler({ query: { id: 'msg-1' } } as any)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' })
  })

  it('returns 404 when message is not found', async () => {
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(mockCollection([], null))
    const res = await updatesById.handler({ query: { id: 'msg-1' } } as any)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Message not found' })
  })

  it('returns 200 with message when found by _id', async () => {
    const doc = makeMessage({ _id: 'msg-1' })
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(mockCollection([], doc))
    const res = await updatesById.handler({ query: { id: 'msg-1' } } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message.id).toBe('msg-1')
  })

  it('trims whitespace from id before lookup', async () => {
    const col = mockCollection([], makeMessage({ _id: 'msg-1' }))
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    await updatesById.handler({ query: { id: '  msg-1  ' } } as any)
    expect(col.findOne).toHaveBeenCalledWith({ _id: 'msg-1', locality: 'bg.sofia' })
  })

  it('accepts array id values by using first valid entry', async () => {
    const col = mockCollection([], makeMessage({ _id: 'msg-1' }))
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    const res = await updatesById.handler({ query: { id: ['msg-1'] } } as any)
    expect(res.status).toBe(200)
  })

  it('extracts loose id from raw URL when query parsing is incomplete', async () => {
    const col = mockCollection([], makeMessage({ _id: 'aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1' }))
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    const res = await updatesById.handler({
      query: {},
      url: '/api/updates/by-id?id=aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1',
    } as any)
    expect(res.status).toBe(200)
    expect(col.findOne).toHaveBeenCalledWith({
      _id: 'aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1',
      locality: 'bg.sofia',
    })
  })

  it('falls back to sourceDocumentId lookup when _id is not found', async () => {
    const col = {
      find: jest.fn(),
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null) // _id not found
        .mockResolvedValueOnce(makeMessage({ _id: 'sourceDocId-123' })), // sourceDocumentId found
    }
    ;(getMessagesCollection as jest.Mock).mockResolvedValue(col)
    const res = await updatesById.handler({ query: { id: 'sourceDocId-123' } } as any)
    expect(res.status).toBe(200)
    expect(col.findOne).toHaveBeenNthCalledWith(2, {
      sourceDocumentId: 'sourceDocId-123',
      locality: 'bg.sofia',
    })
  })
})

// ─── updatesOpenApi endpoint ──────────────────────────────────────────────

describe('updates openapi endpoint (unit)', () => {
  it('returns schema with expected public paths', async () => {
    const res = await updatesOpenApi.handler({} as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('openapi', '3.1.0')
    expect(body.paths).toHaveProperty('/api/updates')
    expect(body.paths).toHaveProperty('/api/updates/by-id')
    expect(body.paths).toHaveProperty('/api/updates-export')
    expect(body.paths).toHaveProperty('/api/updates/sources')
    expect(body.paths['/api/updates/sources'].get.deprecated).toBe(true)
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('400')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('500')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('400')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('404')
    expect(body.paths['/api/updates-export'].get.responses).toHaveProperty('401')
    expect(body.paths['/api/updates-export'].get.responses).toHaveProperty('413')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('401')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('403')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('404')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('502')
  })
})

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

    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV')
    } else {
      Reflect.set(process.env, 'NODE_ENV', originalNodeEnv)
    }

    global.fetch = originalFetch
  })

  it('proxies updates sources metadata', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ sources: [{ id: 'sofia-bg', name: 'Столична община' }] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updatesSources.handler({ query: {} } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/sources')
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.headers).toMatchObject({
      'X-Api-Key': 'test-api-key',
    })

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
