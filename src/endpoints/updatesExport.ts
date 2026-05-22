/**
 * GET /api/updates-export
 *
 * Private endpoint to allow oboapp.online to fetch incremental messages since a given timestamp.
 *
 * Auth: X-Api-Key header must match YSM_OBOAPP_SYNC_API_KEY.
 *
 * Query params:
 *   since=<ISO 8601>   — return records crawled/finalized after this timestamp
 *
 * Response 200:
 *   { since, generatedAt, messages: ExportMessage[] }
 *
 * Response 413:
 *   { error: 'limitExceeded', messageCount: number }
 *   Caller should retry with a more recent `since` value.
 */
import type { Endpoint } from 'payload'
import { timingSafeEqual } from 'crypto'
import { getMessagesCollection, SOFIA_LOCALITY } from '../lib/oboMongo'
import {
  docToUpdateMessage,
  type GeoJsonFeatureCollection,
  type UpdateCadastralProperty,
  type UpdatePin,
  type UpdateStreet,
} from '../lib/oboMessageMapper'

const DEFAULT_LIMIT_MAX = 100

// ─── Export message shape ─────────────────────────────────────────────────

export interface ExportMessage {
  id?: string
  locality?: string
  source?: string
  createdAt: string
  crawledAt?: string
  sourceUrl?: string
  markdownText?: string
  responsibleEntity?: string
  summary?: string
  geoJson?: GeoJsonFeatureCollection
  categories?: string[]
  busStops?: string[]
  cadastralProperties?: UpdateCadastralProperty[]
  cityWide?: boolean
  educationalFacilities?: string[]
  pins?: UpdatePin[]
  streets?: UpdateStreet[]
  timespanEnd?: string
  timespanStart?: string
}

function docToExportMessage(doc: Record<string, unknown>): ExportMessage | null {
  const base = docToUpdateMessage(doc)
  if (!base) return null

  return {
    id: base.id,
    locality: base.locality,
    source: base.source,
    createdAt: base.createdAt,
    crawledAt: base.crawledAt,
    sourceUrl: base.sourceUrl,
    markdownText: base.markdownText,
    responsibleEntity: base.responsibleEntity,
    summary: typeof doc.summary === 'string' ? doc.summary : undefined,
    geoJson: base.geoJson,
    categories: base.categories,
    busStops: base.busStops,
    cadastralProperties: base.cadastralProperties,
    cityWide: base.cityWide,
    educationalFacilities: Array.isArray(doc.educationalFacilities)
      ? doc.educationalFacilities.filter((v): v is string => typeof v === 'string')
      : undefined,
    pins: base.pins,
    streets: base.streets,
    timespanEnd: base.timespanEnd,
    timespanStart: base.timespanStart,
  }
}

// ─── Endpoint ─────────────────────────────────────────────────────────────

export const updatesExport: Endpoint = {
  path: '/updates-export',
  method: 'get',
  handler: async (req) => {
    // ── Auth ──────────────────────────────────────────────────────────────
    const expectedKey = process.env.YSM_OBOAPP_SYNC_API_KEY
    if (!expectedKey) {
      return Response.json({ error: 'YSM_OBOAPP_SYNC_API_KEY is not configured' }, { status: 500 })
    }

    const providedKey = req.headers.get('x-api-key') ?? ''
    const expectedBuf = Buffer.from(expectedKey)
    const providedBuf = Buffer.alloc(expectedBuf.length)
    Buffer.from(providedKey).copy(providedBuf, 0, 0, expectedBuf.length)
    if (!timingSafeEqual(expectedBuf, providedBuf) || providedKey.length !== expectedKey.length) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Mongo config ──────────────────────────────────────────────────────
    if (!process.env.YSM_OBOAPP_MONGODB_URI) {
      return Response.json({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' }, { status: 500 })
    }

    // ── Query params ──────────────────────────────────────────────────────
    const query = (req.query as Record<string, unknown>) ?? {}

    const sinceRaw = typeof query.since === 'string' ? query.since.trim() : undefined
    if (!sinceRaw) {
      return Response.json({ error: 'Missing required query parameter: since' }, { status: 400 })
    }

    const sinceDate = new Date(sinceRaw)
    if (Number.isNaN(sinceDate.getTime())) {
      return Response.json(
        { error: 'Invalid since value — must be an ISO 8601 timestamp' },
        { status: 400 }
      )
    }

    const limitMax = (() => {
      const parsed = Number.parseInt(process.env.YSM_OBOAPP_SYNC_LIMIT_MAX ?? '', 10)
      return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_LIMIT_MAX : parsed
    })()

    // ── Fetch messages ────────────────────────────────────────────────────
    let messagesCollection: Awaited<ReturnType<typeof getMessagesCollection>>
    try {
      messagesCollection = await getMessagesCollection()
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesExport] Failed to connect to updates database')
      return Response.json({ error: 'Failed to connect to updates database' }, { status: 500 })
    }

    let rawMessages: Record<string, unknown>[]
    const messageFilter = {
      locality: SOFIA_LOCALITY,
      $or: [{ crawledAt: { $gt: sinceDate } }, { finalizedAt: { $gt: sinceDate } }],
    }
    try {
      rawMessages = (await messagesCollection
        .find(messageFilter)
        .project({ embedding: 0, process: 0, ingestErrors: 0 })
        .sort({ finalizedAt: -1, crawledAt: -1 })
        // Fetch one extra doc so the overflow check works without pulling all matches into memory
        .limit(limitMax + 1)
        .toArray()) as Record<string, unknown>[]
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesExport] Database query failed')
      return Response.json({ error: 'Failed to query updates database' }, { status: 500 })
    }

    // ── Overflow guard ────────────────────────────────────────────────────
    if (rawMessages.length > limitMax) {
      let messageCount: number
      try {
        messageCount = await messagesCollection.countDocuments(messageFilter)
      } catch (err) {
        req.payload?.logger?.error({ err }, '[updatesExport] Failed to count documents')
        return Response.json({ error: 'Failed to query updates database' }, { status: 500 })
      }
      return Response.json(
        {
          error: 'limitExceeded',
          messageCount,
        },
        { status: 413 }
      )
    }

    // ── Map documents ─────────────────────────────────────────────────────
    const messages: ExportMessage[] = rawMessages
      .map((doc) => {
        const msg = docToExportMessage(doc)
        if (!msg) {
          req.payload?.logger?.warn(
            { docId: String(doc._id ?? '') },
            '[updatesExport] Skipping malformed message document'
          )
        }
        return msg
      })
      .filter((m): m is ExportMessage => m !== null)

    return Response.json({
      since: sinceDate.toISOString(),
      generatedAt: new Date().toISOString(),
      messages,
    })
  },
}
