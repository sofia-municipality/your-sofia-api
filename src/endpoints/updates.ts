import type { Endpoint } from 'payload'
import type { Category, Subscription } from '../payload-types'
import { getMessagesCollection, SOFIA_LOCALITY } from '../lib/oboMongo'
import {
  docToUpdateMessage,
  hasNullPinTimespanStart,
  messageInBounds,
  sortByRelevance,
  type ViewportBounds,
} from '../lib/oboMessageMapper'

const DEFAULT_QUERY_LIMIT = 200
const MAX_QUERY_LIMIT = 500

// ─── Bounding-box helpers ────────────────────────────────────────────────

const LAT_DEGREE_METERS = 111_320

function bboxFromPoint(lat: number, lng: number, radiusMeters: number): ViewportBounds {
  const dLat = radiusMeters / LAT_DEGREE_METERS
  const dLng = radiusMeters / (LAT_DEGREE_METERS * Math.cos((lat * Math.PI) / 180))
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng }
}

function bboxFromPolygon(polygon: {
  type: 'Polygon'
  coordinates: [number, number][][]
}): ViewportBounds | null {
  const coords = polygon.coordinates.flat()
  if (coords.length === 0) return null
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  }
}

function unionBBoxes(boxes: ViewportBounds[]): ViewportBounds {
  return {
    north: Math.max(...boxes.map((b) => b.north)),
    south: Math.min(...boxes.map((b) => b.south)),
    east: Math.max(...boxes.map((b) => b.east)),
    west: Math.min(...boxes.map((b) => b.west)),
  }
}

// ─── Subscription resolution ──────────────────────────────────────────────

interface ResolvedSubscription {
  categories: string[]
  bbox: ViewportBounds | null
}

async function resolveSubscription(
  req: Parameters<Endpoint['handler']>[0],
  tokenString: string
): Promise<ResolvedSubscription | null> {
  const tokenResult = await req.payload.find({
    collection: 'push-tokens',
    where: { token: { equals: tokenString } },
    limit: 1,
  } as any)

  if (tokenResult.totalDocs === 0 || !tokenResult.docs[0]) return null

  const subResult = await req.payload.find({
    collection: 'subscriptions',
    where: { pushToken: { equals: tokenResult.docs[0].id } },
    limit: 1,
    depth: 2, // populate Category + CityDistrict objects
  } as any)

  if (subResult.totalDocs === 0 || !subResult.docs[0]) return null

  const sub = subResult.docs[0] as Subscription

  // ── Categories ──────────────────────────────────────────────────────────
  const categories = ((sub.categories ?? []) as (number | Category)[])
    .map((cat) => (typeof cat === 'object' && cat !== null ? (cat as Category).slug : null))
    .filter((s): s is string => Boolean(s))

  // ── Location filters → bounding box ─────────────────────────────────────
  const locationFilters = sub.locationFilters ?? []

  // If any filter is "all", no spatial constraint
  const hasAllFilter = locationFilters.some((f) => f.filterType === 'all')
  if (hasAllFilter) {
    return { categories, bbox: null }
  }

  const boxes: ViewportBounds[] = []

  for (const filter of locationFilters) {
    if (filter.filterType === 'point') {
      const { latitude, longitude, radius } = filter
      if (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        typeof radius === 'number' &&
        radius > 0
      ) {
        boxes.push(bboxFromPoint(latitude, longitude, radius))
      }
      continue
    }

    if (filter.filterType === 'area') {
      const polygon = filter.polygon as {
        type: 'Polygon'
        coordinates: [number, number][][]
      } | null
      if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
        const box = bboxFromPolygon(polygon)
        if (box) boxes.push(box)
      }
      continue
    }

    if (filter.filterType === 'district') {
      // CityDistricts do not store geometry — spatial filtering for districts
      // is not yet possible. The filter is skipped; only category filtering applies.
      req.payload?.logger?.warn(
        '[updates] District location filter cannot be converted to bounds (no geometry stored) — skipping'
      )
    }
  }

  return { categories, bbox: boxes.length > 0 ? unionBBoxes(boxes) : null }
}

// ─── Endpoint ─────────────────────────────────────────────────────────────

export const updates: Endpoint = {
  path: '/updates',
  method: 'get',
  handler: async (req) => {
    const rawQuery = { ...((req.query as Record<string, unknown>) ?? {}) }

    // Extract pushToken — not a valid oboapp param, handle it here and strip it
    const pushToken = typeof rawQuery.pushToken === 'string' ? rawQuery.pushToken : null
    delete rawQuery.pushToken

    if (pushToken) {
      try {
        const sub = await resolveSubscription(req, pushToken)

        // Only apply subscription filters when the client hasn't sent overrides
        if (sub?.categories.length && !rawQuery.categories) {
          rawQuery.categories = sub.categories.join(',')
        }

        if (
          sub?.bbox &&
          rawQuery.north === undefined &&
          rawQuery.south === undefined &&
          rawQuery.east === undefined &&
          rawQuery.west === undefined
        ) {
          rawQuery.north = sub.bbox.north
          rawQuery.south = sub.bbox.south
          rawQuery.east = sub.bbox.east
          rawQuery.west = sub.bbox.west
        }
      } catch (err) {
        req.payload?.logger?.error(
          { err },
          '[updates] Failed to resolve subscription — falling back to unfiltered'
        )
      }
    }

    // Default to items whose timespan hasn't fully ended before today
    if (rawQuery.timespanEndGte === undefined || rawQuery.timespanEndGte === null) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      rawQuery.timespanEndGte = dayStart.toISOString()
    }

    // Parse the category filter
    const categoriesFilter =
      typeof rawQuery.categories === 'string' && rawQuery.categories.trim()
        ? rawQuery.categories
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : null

    // Parse optional viewport bounds
    const toNum = (v: unknown): number | undefined => {
      if (typeof v === 'string' && v.trim() === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }
    const north = toNum(rawQuery.north)
    const south = toNum(rawQuery.south)
    const east = toNum(rawQuery.east)
    const west = toNum(rawQuery.west)
    const hasBounds =
      north !== undefined && south !== undefined && east !== undefined && west !== undefined
    const bounds: ViewportBounds | null = hasBounds
      ? { north: north!, south: south!, east: east!, west: west! }
      : null

    // Parse timespanEndGte (already defaulted above)
    const timespanEndGte = rawQuery.timespanEndGte
    const cutoffDate = timespanEndGte ? new Date(String(timespanEndGte)) : new Date()
    if (Number.isNaN(cutoffDate.getTime())) {
      return Response.json({ error: 'Invalid timespanEndGte value' }, { status: 400 })
    }

    const parseNonNegativeInt = (value: unknown, field: 'limit' | 'offset'): number | null => {
      if (value === undefined || value === null || value === '') {
        return field === 'limit' ? DEFAULT_QUERY_LIMIT : 0
      }
      const parsed = Number.parseInt(String(value), 10)
      if (Number.isNaN(parsed) || parsed < 0) return null
      return parsed
    }

    const requestedLimit = parseNonNegativeInt(rawQuery.limit, 'limit')
    if (requestedLimit === null) {
      return Response.json({ error: 'Invalid limit value' }, { status: 400 })
    }
    const offset = parseNonNegativeInt(rawQuery.offset, 'offset')
    if (offset === null) {
      return Response.json({ error: 'Invalid offset value' }, { status: 400 })
    }
    const limit = Math.min(requestedLimit, MAX_QUERY_LIMIT)

    // ── Build Mongo filter ───────────────────────────────────────────────
    if (!process.env.YSM_OBOAPP_MONGODB_URI) {
      return Response.json({ error: 'YSM_OBOAPP_MONGODB_URI is not configured' }, { status: 500 })
    }

    let messagesCollection: Awaited<ReturnType<typeof getMessagesCollection>>
    try {
      messagesCollection = await getMessagesCollection()
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updates] Failed to connect to OboApp MongoDB')
      return Response.json({ error: 'Failed to connect to OboApp database' }, { status: 500 })
    }

    // timespanEnd is stored as BSON Date by OboApp (confirmed in firestore-to-mongo migration);
    // Date comparison is correct here.
    const mongoFilter: Record<string, unknown> = {
      timespanEnd: { $gte: cutoffDate },
      locality: SOFIA_LOCALITY,
    }

    if (categoriesFilter && categoriesFilter.length > 0) {
      // Include messages that match any requested category OR are cityWide
      mongoFilter.$or = [{ categories: { $in: categoriesFilter } }, { cityWide: true }]
    }

    let rawDocs: Record<string, unknown>[]
    try {
      rawDocs = (await messagesCollection
        .find(mongoFilter)
        // Exclude large internal fields not used by docToUpdateMessage
        .project({ embedding: 0, process: 0, ingestErrors: 0 })
        .sort({ finalizedAt: -1, timespanEnd: -1 })
        .skip(offset)
        .limit(limit)
        .toArray()) as Record<string, unknown>[]
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updates] Mongo query failed')
      return Response.json({ error: 'Failed to query OboApp database' }, { status: 500 })
    }

    // ── Map, filter and sort ─────────────────────────────────────────────
    let messages = rawDocs
      .map((doc) => {
        const msg = docToUpdateMessage(doc)
        if (!msg) {
          req.payload?.logger?.warn(
            { docId: String(doc._id ?? '') },
            '[updates] Skipping malformed message document'
          )
        }
        return msg
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null)

    // Drop messages with null pin timespan starts
    messages = messages.filter((msg) => {
      if (hasNullPinTimespanStart(msg)) {
        req.payload?.logger?.warn(
          { messageId: msg.id, text: msg.text?.slice(0, 120) },
          '[updates] Dropping message — pin has null timespans.start'
        )
        return false
      }
      return true
    })

    // Apply viewport bounds filter
    if (bounds) {
      messages = messages.filter((msg) => messageInBounds(msg, bounds))
    }

    return Response.json({
      messages: sortByRelevance(messages),
      pagination: {
        limit,
        offset,
      },
    })
  },
}
