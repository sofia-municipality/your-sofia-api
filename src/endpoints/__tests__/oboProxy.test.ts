import { updates } from '../updates'
import { updatesById } from '../updatesById'
import { updatesOpenApi } from '../updatesOpenApi'
import { updatesSources } from '../updatesSources'

describe('updates proxy endpoints (unit)', () => {
  const originalBaseUrl = process.env.OBOAPP_UPDATES_BASE_URL
  const originalApiKey = process.env.OBOAPP_API_KEY
  const originalNodeEnv = process.env.NODE_ENV
  const originalFetch = global.fetch
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1'
    process.env.OBOAPP_API_KEY = 'test-api-key'
    Reflect.set(process.env, 'NODE_ENV', 'test')
    global.fetch = jest.fn()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
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
    consoleErrorSpy.mockRestore()
  })

  it('proxies updates list and forwards query params', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updates.handler({
      query: {
        categories: 'water,traffic',
        north: '42.9',
      },
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages?')
    expect(calledUrl).toContain('categories=water%2Ctraffic')
    expect(calledUrl).toContain('north=42.9')
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.headers).toMatchObject({
      'X-Api-Key': 'test-api-key',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ messages: [] })
  })

  it('forwards array query parameters as repeated params', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updates.handler({
      query: {
        categories: ['water', 'traffic'],
      },
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages?')
    expect(calledUrl).toContain('categories=water')
    expect(calledUrl).toContain('categories=traffic')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ messages: [] })
  })

  it('adds default timespanEndGte filter when missing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updates.handler({ query: {} } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]))
    const timespanEndGte = calledUrl.searchParams.get('timespanEndGte')

    expect(timespanEndGte).toBeTruthy()
    expect(Number.isNaN(Date.parse(timespanEndGte!))).toBe(false)
    expect(res.status).toBe(200)
  })

  it('preserves provided timespanEndGte filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const providedFilter = '2026-02-23T00:00:00.000Z'
    const res = await updates.handler({ query: { timespanEndGte: providedFilter } } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]))
    expect(calledUrl.searchParams.get('timespanEndGte')).toBe(providedFilter)
    expect(res.status).toBe(200)
  })

  it('returns 400 when id is missing for updates-by-id', async () => {
    const res = await updatesById.handler({ query: {} } as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing required query parameter: id' })
  })

  it.each([
    ['', 'empty string'],
    ['   ', 'whitespace-only string'],
  ])('returns 400 when id is %s for updates-by-id', async (id) => {
    const res = await updatesById.handler({ query: { id } } as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing required query parameter: id' })
  })

  it('accepts array id values for updates-by-id by using first valid entry', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: { id: 'm-1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updatesById.handler({ query: { id: ['m-1'] } } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages/by-id?id=m-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: { id: 'm-1' } })
  })

  it('proxies update-by-id when id is provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: { id: 'm-1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updatesById.handler({
      query: {
        id: 'm-1',
      },
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages/by-id?id=m-1')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: { id: 'm-1' } })
  })

  it('forwards trimmed id to upstream for updates-by-id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: { id: 'm-1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updatesById.handler({
      query: {
        id: '  m-1  ',
      },
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages/by-id?id=m-1')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: { id: 'm-1' } })
  })

  it('extracts loose id from raw URL when query parsing is incomplete', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: { id: 'aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updatesById.handler({
      query: {},
      url: '/api/updates/by-id?id=aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1',
    } as any)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain(
      'https://obo.example.com/api/v1/messages/by-id?id=aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1'
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: { id: 'aHR0cHM6Ly9leGFtcGxlLmNvbS8_-1' } })
  })

  it('returns 500 when OBOAPP_UPDATES_BASE_URL is not configured', async () => {
    Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'OBOAPP_UPDATES_BASE_URL is not configured' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 500 when OBOAPP_UPDATES_BASE_URL is malformed', async () => {
    process.env.OBOAPP_UPDATES_BASE_URL = 'not a valid url'

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'OBOAPP_UPDATES_BASE_URL is invalid' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 500 when OBOAPP_API_KEY is not configured', async () => {
    Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'OBOAPP_API_KEY is not configured' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 502 with timeout-specific error when upstream request aborts', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(
      new DOMException('The operation was aborted.', 'AbortError')
    )

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({
      error: 'Request timed out after 15 seconds',
    })
  })

  it('returns 502 with upstream communication error for non-timeout failures', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'development')
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network unavailable'))

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({
      error: 'Failed to communicate with OboApp upstream API',
      message: 'network unavailable',
    })
  })

  it('does not expose raw upstream error message in production', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production')
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network unavailable'))

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: 'Failed to communicate with OboApp upstream API',
    })
  })

  it('maps upstream 5xx responses to 502 with consistent payload', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response('upstream down', {
        status: 503,
        headers: {
          'content-type': 'text/plain',
        },
      })
    )

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: 'Failed to communicate with OboApp upstream API',
    })
  })

  it('passes through upstream 4xx responses', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found upstream' }), {
        status: 404,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const res = await updates.handler({ query: {} } as any)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found upstream' })
  })

  it('normalizes multiple trailing slashes in upstream base url', async () => {
    process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1///'
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    await updates.handler({ query: {} } as any)

    const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(calledUrl).toContain('https://obo.example.com/api/v1/messages')
    expect(calledUrl).not.toContain('/api/v1//messages')
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
})

describe('updates openapi endpoint (unit)', () => {
  it('returns proxy schema with expected public paths', async () => {
    const res = await updatesOpenApi.handler({} as any)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('openapi', '3.1.0')
    expect(body.paths).toHaveProperty('/api/updates')
    expect(body.paths).toHaveProperty('/api/updates/by-id')
    expect(body.paths).toHaveProperty('/api/updates/sources')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('400')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('401')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('403')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('404')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('500')
    expect(body.paths['/api/updates'].get.responses).toHaveProperty('502')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('401')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('403')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('404')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('500')
    expect(body.paths['/api/updates/by-id'].get.responses).toHaveProperty('502')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('401')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('403')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('404')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('500')
    expect(body.paths['/api/updates/sources'].get.responses).toHaveProperty('502')
    expect(body.paths).not.toHaveProperty('/api/obo/messages')
    expect(body.paths).not.toHaveProperty('/api/obo/messages/by-id')
  })
})
