import { fetchActiveUpdates, isOboRestConfigured } from '../oboUpdatesSource'

// ─── Env management ─────────────────────────────────────────────────────────

const ORIGINAL_BASE = process.env.OBOAPP_UPDATES_BASE_URL
const ORIGINAL_KEY = process.env.OBOAPP_API_KEY
const ORIGINAL_FETCH = global.fetch

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name)
  else process.env[name] = value
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1'
  process.env.OBOAPP_API_KEY = 'test-key'
  global.fetch = jest.fn()
})

afterEach(() => {
  restoreEnv('OBOAPP_UPDATES_BASE_URL', ORIGINAL_BASE)
  restoreEnv('OBOAPP_API_KEY', ORIGINAL_KEY)
  global.fetch = ORIGINAL_FETCH
  jest.clearAllMocks()
})

// ─── isOboRestConfigured ─────────────────────────────────────────────────────

describe('isOboRestConfigured', () => {
  it('is true only when both base url and api key are set', () => {
    expect(isOboRestConfigured()).toBe(true)
    Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
    expect(isOboRestConfigured()).toBe(false)
  })
})

// ─── fetchActiveUpdates ──────────────────────────────────────────────────────

describe('fetchActiveUpdates', () => {
  it('throws when the base url is not configured', async () => {
    Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
    await expect(fetchActiveUpdates()).rejects.toThrow('OBOAPP_UPDATES_BASE_URL is not configured')
  })

  it('throws when the api key is not configured', async () => {
    Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
    await expect(fetchActiveUpdates()).rejects.toThrow('OBOAPP_API_KEY is not configured')
  })

  it('throws on a non-2xx upstream response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(new Response('nope', { status: 503 }))
    await expect(fetchActiveUpdates()).rejects.toThrow('OboApp upstream returned 503')
  })

  it('throws when the body has no messages array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ notMessages: true }))
    await expect(fetchActiveUpdates()).rejects.toThrow('missing a messages array')
  })

  it('calls the /messages endpoint with the API key header', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ messages: [] }))
    await fetchActiveUpdates()
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toBe('https://obo.example.com/api/v1/messages')
    expect(init.headers['X-Api-Key']).toBe('test-key')
  })

  it('maps upstream messages into UpdateMessage shape', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        messages: [
          {
            id: 'rest-1',
            text: 'Hello',
            createdAt: '2026-01-01T00:00:00.000Z',
            timespanEnd: '2026-01-10T00:00:00.000Z',
            categories: ['water'],
          },
        ],
      })
    )
    const result = await fetchActiveUpdates()
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('rest-1')
    expect(result[0]!.text).toBe('Hello')
    expect(result[0]!.categories).toEqual(['water'])
  })

  it('drops entries that cannot be mapped', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        messages: [null, { id: 'ok', text: 'x', createdAt: '2026-01-01T00:00:00.000Z' }],
      })
    )
    const result = await fetchActiveUpdates()
    expect(result.map((m) => m.id)).toEqual(['ok'])
  })
})
