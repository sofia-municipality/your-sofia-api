import type { Endpoint } from 'payload'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

function normalizeIdValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeIdValue(item)
      if (normalized) {
        return normalized
      }
    }
  }

  return null
}

function extractIdFromRawUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null
  }

  const queryStart = rawUrl.indexOf('?')
  if (queryStart < 0) {
    return null
  }

  const query = rawUrl.slice(queryStart + 1)
  const match = query.match(/(?:^|&)id=([^&]*)/)
  if (!match) {
    return null
  }

  const rawId = match[1]
  if (!rawId) {
    return null
  }

  try {
    return normalizeIdValue(decodeURIComponent(rawId.replace(/\+/g, ' ')))
  } catch {
    return normalizeIdValue(rawId)
  }
}

export const updatesById: Endpoint = {
  path: '/updates/by-id',
  method: 'get',
  handler: async (req) => {
    const idFromRawUrl = extractIdFromRawUrl(req.url)
    const idFromQuery = normalizeIdValue(req.query?.id)
    const id = idFromRawUrl ?? idFromQuery

    if (!id) {
      return Response.json({ error: 'Missing required query parameter: id' }, { status: 400 })
    }

    const upstreamQuery = {
      ...(req.query as Record<string, unknown> | undefined),
      id,
    }

    return proxyUpdatesUpstreamGet('/messages/by-id', upstreamQuery, {
      logger: req.payload?.logger,
    })
  },
}
