import type { Endpoint } from 'payload'
import { getMessagesCollection, SOFIA_LOCALITY } from '../lib/oboMongo'
import { docToUpdateMessage } from '../lib/oboMessageMapper'

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

    if (!process.env.YSM_OBOAPP_MONGODB_URI) {
      return Response.json({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' }, { status: 500 })
    }

    let messagesCollection: Awaited<ReturnType<typeof getMessagesCollection>>
    try {
      messagesCollection = await getMessagesCollection()
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesById] Failed to connect to OboApp MongoDB')
      return Response.json({ error: 'Failed to connect to OboApp database' }, { status: 500 })
    }

    let doc: Record<string, unknown> | null = null
    try {
      // OboApp stores _id as a plain string (not ObjectId) — string equality match is correct.
      doc = (await messagesCollection.findOne({
        _id: id as any,
        locality: SOFIA_LOCALITY,
      })) as Record<string, unknown> | null

      // Fallback: look up by sourceDocumentId (Firestore doc ID preserved on migration)
      if (!doc) {
        doc = (await messagesCollection.findOne({
          sourceDocumentId: id,
          locality: SOFIA_LOCALITY,
        })) as Record<string, unknown> | null
      }
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesById] Mongo query failed')
      return Response.json({ error: 'Failed to query OboApp database' }, { status: 500 })
    }

    if (!doc) {
      return Response.json({ error: 'Message not found' }, { status: 404 })
    }

    const message = docToUpdateMessage(doc)
    if (!message) {
      return Response.json({ error: 'Message data is malformed' }, { status: 500 })
    }

    return Response.json({ message })
  },
}
