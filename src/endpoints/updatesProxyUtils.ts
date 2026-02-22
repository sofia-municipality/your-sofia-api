const DEFAULT_TIMEOUT_MS = 15000

type ProxyLogger = {
  error: (...args: unknown[]) => void
}

type ProxyOptions = {
  logger?: ProxyLogger
}

function logProxyError(logger: ProxyLogger | undefined, message: string, meta: unknown): void {
  if (logger) {
    logger.error(meta, message)
    return
  }

  console.error(message, meta)
}

function ensureNoTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function appendQueryParams(url: URL, query?: Record<string, unknown>): void {
  if (!query) return

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item))
        }
      })
      return
    }

    url.searchParams.append(key, String(value))
  })
}

export function getUpdatesUpstreamBaseUrl(): string | null {
  const baseUrl = process.env.OBOAPP_UPDATES_BASE_URL

  if (!baseUrl) {
    return null
  }

  return ensureNoTrailingSlash(baseUrl)
}

export function buildUpdatesUpstreamUrl(path: string, query?: Record<string, unknown>): URL | null {
  const baseUrl = getUpdatesUpstreamBaseUrl()

  if (!baseUrl) {
    return null
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  let url: URL

  try {
    url = new URL(`${baseUrl}${normalizedPath}`)
  } catch {
    return null
  }

  appendQueryParams(url, query)

  return url
}

export async function proxyUpdatesUpstreamGet(
  path: string,
  query?: Record<string, unknown>,
  options?: ProxyOptions
): Promise<Response> {
  if (!process.env.OBOAPP_UPDATES_BASE_URL) {
    return Response.json(
      {
        error: 'OBOAPP_UPDATES_BASE_URL is not configured',
      },
      { status: 500 }
    )
  }

  const targetUrl = buildUpdatesUpstreamUrl(path, query)

  if (!targetUrl) {
    return Response.json(
      {
        error: 'OBOAPP_UPDATES_BASE_URL is invalid',
      },
      { status: 500 }
    )
  }

  const upstreamApiKey = process.env.OBOAPP_API_KEY

  if (!upstreamApiKey) {
    return Response.json(
      {
        error: 'OBOAPP_API_KEY is not configured',
      },
      { status: 500 }
    )
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': upstreamApiKey,
      },
      signal: abortController.signal,
    })

    const responseText = await upstreamResponse.text()

    if (!upstreamResponse.ok && upstreamResponse.status >= 500) {
      logProxyError(options?.logger, '[updatesProxy] Upstream returned server error', {
        path,
        query,
        upstreamStatus: upstreamResponse.status,
      })

      return Response.json(
        {
          error: 'Failed to communicate with OboApp upstream API',
        },
        { status: 502 }
      )
    }

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: {
        'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    const isAbortError =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logProxyError(options?.logger, '[updatesProxy] Upstream request failed', {
      path,
      query,
      isAbortError,
      errorMessage,
    })

    const responseBody: { error: string; message?: string } = {
      error: isAbortError
        ? `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000} seconds`
        : 'Failed to communicate with OboApp upstream API',
    }

    if (process.env.NODE_ENV === 'development') {
      responseBody.message = errorMessage
    }

    return Response.json(responseBody, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
