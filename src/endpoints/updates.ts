import type { Endpoint } from 'payload'
import type { Category, Subscription } from '../payload-types'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

// ─── Bounding-box helpers ──────────────────────────────────────────────────

interface BBox {
  north: number
  south: number
  east: number
  west: number
}

const LAT_DEGREE_METERS = 111_320

function bboxFromPoint(lat: number, lng: number, radiusMeters: number): BBox {
  const dLat = radiusMeters / LAT_DEGREE_METERS
  const dLng = radiusMeters / (LAT_DEGREE_METERS * Math.cos((lat * Math.PI) / 180))
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng }
}

function bboxFromPolygon(polygon: {
  type: 'Polygon'
  coordinates: [number, number][][]
}): BBox | null {
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

function unionBBoxes(boxes: BBox[]): BBox {
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
  bbox: BBox | null
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

  const boxes: BBox[] = []

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

    return proxyUpdatesUpstreamGet('/messages', rawQuery, {
      logger: req.payload?.logger,
    })
  },
}
