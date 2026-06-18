import type { Endpoint } from 'payload'
import { SOFIA_LOCALITY, type UpdateMessage } from '../lib/oboMessageMapper'

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

    let doc: { data: UpdateMessage } | undefined
    try {
      const result = await req.payload.find({
        collection: 'obo-updates',
        where: {
          oboId: { equals: id },
          locality: { equals: SOFIA_LOCALITY },
        },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      doc = result.docs[0] as unknown as { data: UpdateMessage } | undefined
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesById] Failed to query updates cache')
      return Response.json({ error: 'Failed to query updates' }, { status: 500 })
    }

    if (!doc) {
      return Response.json({ error: 'Message not found' }, { status: 404 })
    }

    return Response.json({ message: doc.data })
  },
}
