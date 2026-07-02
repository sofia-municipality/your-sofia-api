import { updatesExport } from '../updatesExport'

// ─── Mock oboMongo ────────────────────────────────────────────────────────

jest.mock('../../lib/oboMongo', () => ({
  getMessagesCollection: jest.fn(),
}))

import { getMessagesCollection } from '../../lib/oboMongo'

// ─── Helpers ──────────────────────────────────────────────────────────────

const VALID_SINCE = '2026-01-01T00:00:00.000Z'

function makeReq(
  overrides: {
    headers?: Record<string, string>
    query?: Record<string, unknown>
    payload?: { logger?: { error?: jest.Mock; warn?: jest.Mock } }
  } = {}
) {
  const headers = new Map(Object.entries({ 'x-api-key': 'secret-key', ...overrides.headers }))
  return {
    headers: { get: (k: string) => headers.get(k) ?? null },
    query: overrides.query !== undefined ? overrides.query : { since: VALID_SINCE },
    payload: overrides.payload ?? {},
  } as any
}

function makeMessageDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'msg-export-1',
    text: 'Export message',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    crawledAt: new Date('2026-01-02T01:00:00.000Z'),
    finalizedAt: new Date('2026-01-02T02:00:00.000Z'),
    timespanStart: new Date('2026-01-02T00:00:00.000Z'),
    timespanEnd: new Date('2026-01-10T00:00:00.000Z'),
    locality: 'bg.sofia',
    categories: ['water'],
    ...overrides,
  }
}

function makeCursor(docs: Record<string, unknown>[]) {
  return {
    project: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(docs),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('updatesExport endpoint (unit)', () => {
  const originalUri = process.env.YSM_OBOAPP_MONGODB_URI
  const originalKey = process.env.YSM_OBOAPP_SYNC_API_KEY

  beforeEach(() => {
    process.env.YSM_OBOAPP_MONGODB_URI = 'mongodb://localhost:27017'
    process.env.YSM_OBOAPP_SYNC_API_KEY = 'secret-key'
  })

  afterEach(() => {
    if (originalUri === undefined) {
      Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    } else {
      process.env.YSM_OBOAPP_MONGODB_URI = originalUri
    }
    if (originalKey === undefined) {
      Reflect.deleteProperty(process.env, 'YSM_OBOAPP_SYNC_API_KEY')
    } else {
      process.env.YSM_OBOAPP_SYNC_API_KEY = originalKey
    }
    jest.clearAllMocks()
  })

  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when X-Api-Key header is missing', async () => {
    const req = makeReq({ headers: { 'x-api-key': '' } })
    // Overwrite to simulate absent header
    req.headers.get = (k: string) => (k === 'x-api-key' ? null : null)
    const res = await updatesExport.handler(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when X-Api-Key is wrong', async () => {
    const res = await updatesExport.handler(makeReq({ headers: { 'x-api-key': 'wrong-key' } }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 500 when YSM_OBOAPP_SYNC_API_KEY is not configured', async () => {
    Reflect.deleteProperty(process.env, 'YSM_OBOAPP_SYNC_API_KEY')
    const res = await updatesExport.handler(makeReq())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'YSM_OBOAPP_SYNC_API_KEY is not configured' })
  })

  // ── Config ────────────────────────────────────────────────────────────

  it('returns 500 when YSM_OBOAPP_MONGODB_URI is not configured', async () => {
    Reflect.deleteProperty(process.env, 'YSM_OBOAPP_MONGODB_URI')
    const res = await updatesExport.handler(makeReq())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' })
  })

  // ── Input validation ──────────────────────────────────────────────────

  it('returns 400 when since param is missing', async () => {
    const res = await updatesExport.handler(makeReq({ query: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Missing required query parameter: since' })
  })

  it('returns 400 when since is not a valid ISO timestamp', async () => {
    const res = await updatesExport.handler(makeReq({ query: { since: 'not-a-date' } }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Invalid since') })
  })

  // ── Success ───────────────────────────────────────────────────────────

  it('returns 200 with messages', async () => {
    const msgDoc = makeMessageDoc()
    ;(getMessagesCollection as jest.Mock).mockResolvedValue({
      find: jest.fn().mockReturnValue(makeCursor([msgDoc])),
    })

    const res = await updatesExport.handler(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.since).toBe(VALID_SINCE)
    expect(body.generatedAt).toBeTruthy()
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].id).toBe('msg-export-1')
    expect(body).not.toHaveProperty('sources')
  })

  it('does not include internal message fields in export', async () => {
    const msgDoc = makeMessageDoc({
      embedding: [0.1, 0.2],
      process: 'some-process',
      ingestErrors: ['err'],
      isRelevant: false,
      isUnreadable: true,
      eventId: 'ev-1',
      notificationsSent: true,
    })
    ;(getMessagesCollection as jest.Mock).mockResolvedValue({
      find: jest.fn().mockReturnValue(makeCursor([msgDoc])),
    })

    const res = await updatesExport.handler(makeReq())
    const body = await res.json()
    const msg = body.messages[0]
    expect(msg).not.toHaveProperty('embedding')
    expect(msg).not.toHaveProperty('process')
    expect(msg).not.toHaveProperty('ingestErrors')
    expect(msg).not.toHaveProperty('notificationsSent')
    expect(msg).not.toHaveProperty('sourceDocumentId')
    expect(msg).not.toHaveProperty('text')
    expect(msg).not.toHaveProperty('plainText')
    expect(msg).not.toHaveProperty('addresses')
    expect(msg).not.toHaveProperty('finalizedAt')
  })

  it('includes summary and educationalFacilities when present', async () => {
    const msgDoc = makeMessageDoc({
      summary: 'A short summary',
      educationalFacilities: ['School A', 'School B'],
    })
    ;(getMessagesCollection as jest.Mock).mockResolvedValue({
      find: jest.fn().mockReturnValue(makeCursor([msgDoc])),
    })

    const res = await updatesExport.handler(makeReq())
    const body = await res.json()
    const msg = body.messages[0]
    expect(msg.summary).toBe('A short summary')
    expect(msg.educationalFacilities).toEqual(['School A', 'School B'])
  })

  // ── Overflow ──────────────────────────────────────────────────────────

  it('returns 413 when message count exceeds limit', async () => {
    process.env.YSM_OBOAPP_SYNC_LIMIT_MAX = '3'
    const msgs = Array.from({ length: 4 }, (_, i) => makeMessageDoc({ _id: `msg-${i}` }))
    const countDocuments = jest.fn().mockResolvedValue(42)
    ;(getMessagesCollection as jest.Mock).mockResolvedValue({
      find: jest.fn().mockReturnValue(makeCursor(msgs)),
      countDocuments,
    })

    const res = await updatesExport.handler(makeReq())
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('limitExceeded')
    expect(body.messageCount).toBe(42)
    expect(countDocuments).toHaveBeenCalledTimes(1)
    expect(body).not.toHaveProperty('sourceCount')

    Reflect.deleteProperty(process.env, 'YSM_OBOAPP_SYNC_LIMIT_MAX')
  })

  it('passes since date as $gt filter to messages collection', async () => {
    const msgsCursor = makeCursor([])
    const msgsFindMock = jest.fn().mockReturnValue(msgsCursor)
    ;(getMessagesCollection as jest.Mock).mockResolvedValue({ find: msgsFindMock })

    await updatesExport.handler(makeReq({ query: { since: VALID_SINCE } }))

    const msgsFilter = msgsFindMock.mock.calls[0][0]
    expect(msgsFilter.$or).toBeDefined()
    const crawledGt = msgsFilter.$or.find(
      (c: Record<string, unknown>) => (c.crawledAt as Record<string, unknown>)?.$gt
    )
    expect(crawledGt.crawledAt.$gt).toEqual(new Date(VALID_SINCE))
  })
})
