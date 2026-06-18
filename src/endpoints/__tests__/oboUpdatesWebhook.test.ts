// Mock the persistence layer so these tests cover auth, validation, routing
// and error handling in isolation (the store has its own unit tests).
jest.mock('../../lib/oboUpdatesStore', () => ({
  upsertOboUpdate: jest.fn(),
  deleteOboUpdate: jest.fn(),
}))

import { oboUpdatesWebhook, timingSafeEqualStr } from '../oboUpdatesWebhook'
import { deleteOboUpdate, upsertOboUpdate } from '../../lib/oboUpdatesStore'

const mockUpsert = upsertOboUpdate as jest.Mock
const mockDelete = deleteOboUpdate as jest.Mock

const VALID_KEY = 'super-secret-key'
const ORIGINAL_KEY = process.env.OBO_WEBHOOK_API_KEY

function makeReq(options: { key?: string | null; body?: unknown; jsonThrows?: boolean } = {}) {
  const headers = {
    get: (name: string) => (name.toLowerCase() === 'x-api-key' ? (options.key ?? null) : null),
  }
  return {
    headers,
    json: options.jsonThrows
      ? async () => {
          throw new Error('bad json')
        }
      : async () => options.body,
    payload: { logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } },
  } as any
}

const validMessage = {
  id: 'obo-1',
  text: 'Water outage',
  createdAt: '2026-01-01T00:00:00.000Z',
  locality: 'bg.sofia',
}

beforeEach(() => {
  process.env.OBO_WEBHOOK_API_KEY = VALID_KEY
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) Reflect.deleteProperty(process.env, 'OBO_WEBHOOK_API_KEY')
  else process.env.OBO_WEBHOOK_API_KEY = ORIGINAL_KEY
  jest.clearAllMocks()
})

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 503 when no webhook key is configured', async () => {
    Reflect.deleteProperty(process.env, 'OBO_WEBHOOK_API_KEY')
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted', id: 'x' } })
    )
    expect(res.status).toBe(503)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns 401 when the API key header is missing', async () => {
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: null, body: { event: 'deleted', id: 'x' } })
    )
    expect(res.status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns 401 when the API key is wrong', async () => {
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: 'wrong-key', body: { event: 'deleted', id: 'x' } })
    )
    expect(res.status).toBe(401)
  })

  it('does not parse the body before authenticating', async () => {
    // jsonThrows would surface as 400 if the body were read; auth must short-circuit first.
    const res = await oboUpdatesWebhook.handler!(makeReq({ key: 'wrong-key', jsonThrows: true }))
    expect(res.status).toBe(401)
  })
})

describe('timingSafeEqualStr', () => {
  it('is true only for identical strings', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true)
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false)
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false) // differing length, no throw
  })
})

// ─── Body validation ─────────────────────────────────────────────────────────

describe('body validation', () => {
  it('returns 400 on invalid JSON', async () => {
    const res = await oboUpdatesWebhook.handler!(makeReq({ key: VALID_KEY, jsonThrows: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when event is missing or unknown', async () => {
    expect((await oboUpdatesWebhook.handler!(makeReq({ key: VALID_KEY, body: {} }))).status).toBe(
      400
    )
    expect(
      (await oboUpdatesWebhook.handler!(makeReq({ key: VALID_KEY, body: { event: 'foo' } }))).status
    ).toBe(400)
  })

  it('returns 400 for created/updated without a message object', async () => {
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'created' } })
    )
    expect(res.status).toBe(400)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 when the message cannot be parsed to an id', async () => {
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'updated', message: {} } })
    )
    expect(res.status).toBe(400)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 for a deleted event without an id', async () => {
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted' } })
    )
    expect(res.status).toBe(400)
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

// ─── Create / update ─────────────────────────────────────────────────────────

describe('created / updated', () => {
  it('upserts and reports "created"', async () => {
    mockUpsert.mockResolvedValue('created')
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'created', message: validMessage } })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      event: 'created',
      id: 'obo-1',
      result: 'created',
    })
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(mockUpsert.mock.calls[0][1].id).toBe('obo-1')
  })

  it('upserts and reports "updated"', async () => {
    mockUpsert.mockResolvedValue('updated')
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'updated', message: validMessage } })
    )
    expect(await res.json()).toMatchObject({ event: 'updated', result: 'updated' })
  })

  it('returns 500 when the upsert fails', async () => {
    mockUpsert.mockRejectedValue(new Error('db down'))
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'created', message: validMessage } })
    )
    expect(res.status).toBe(500)
  })
})

// ─── Delete ──────────────────────────────────────────────────────────────────

describe('deleted', () => {
  it('deletes by id and reports "deleted"', async () => {
    mockDelete.mockResolvedValue(1)
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted', id: 'obo-1' } })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      event: 'deleted',
      id: 'obo-1',
      result: 'deleted',
    })
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), 'obo-1')
  })

  it('reports "missing" (still 200) when the id was not cached', async () => {
    mockDelete.mockResolvedValue(0)
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted', id: 'ghost' } })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ result: 'missing' })
  })

  it('accepts the id from message.id when no top-level id is given', async () => {
    mockDelete.mockResolvedValue(1)
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted', message: { id: 'from-msg' } } })
    )
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), 'from-msg')
  })

  it('returns 500 when the delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('db down'))
    const res = await oboUpdatesWebhook.handler!(
      makeReq({ key: VALID_KEY, body: { event: 'deleted', id: 'obo-1' } })
    )
    expect(res.status).toBe(500)
  })
})
