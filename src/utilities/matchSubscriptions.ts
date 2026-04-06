/**
 * matchSubscriptions
 *
 * Given a published News document, find all active push token strings that
 * should receive the notification based on their subscriptions.
 *
 * Matching rules:
 *  1. Subscription must have at least one matching category (OR logic).
 *     If news.categories is empty the caller should broadcast to all — this
 *     function should not be called in that case.
 *  2. If the subscription's locationFilters array is empty, it matches every
 *     location.
 *  3. Otherwise, at least one locationFilter must pass (OR logic).
 *     3a. filterType = 'all'      → always matches
 *     3b. filterType = 'district' → news.district must equal filter.district
 *     3c. filterType = 'point'    → PostGIS ST_DWithin check against news coords
 *     3d. filterType = 'area'     → PostGIS ST_Contains polygon check
 */

import type { Payload } from 'payload'
import { Expo } from 'expo-server-sdk'

/** Shape of the news document once categories + district are generated into payload-types.ts */
interface NewsWithSubscriptionFields {
  id: number | string
  categories?: ({ id: number | string } | number | string)[] | null
  district?: { id: number | string } | number | string | null
  location?: {
    latitude?: number | null
    longitude?: number | null
  } | null
}

interface LocationFilter {
  id?: string | null
  filterType: 'all' | 'district' | 'point' | 'area'
  district?: { id: number | string } | number | string | null
  latitude?: number | null
  longitude?: number | null
  radius?: number | null
  polygon?: unknown
}

interface SubscriptionDoc {
  id: number | string
  pushToken: { id: number | string; token: string; active?: boolean | null } | number | string
  categories?: ({ id: number | string } | number | string)[] | null
  locationFilters?: LocationFilter[] | null
}

function getId(ref: { id: number | string } | number | string): number | string {
  if (typeof ref === 'object' && ref !== null) return ref.id
  return ref
}

function locationFilterMatches(
  filter: LocationFilter,
  newsDistrictId: number | string | null | undefined,
  newsLat: number | null | undefined,
  newsLng: number | null | undefined
): boolean {
  switch (filter.filterType) {
    case 'all':
      return true

    case 'district': {
      if (!newsDistrictId || !filter.district) return false
      return String(getId(filter.district)) === String(newsDistrictId)
    }

    case 'point':
    case 'area':
      // PostGIS matching is handled separately via raw SQL (see below).
      // Return false here — we handle these in the DB query.
      return false

    default:
      return false
  }
}

export async function matchSubscriptions(
  payload: Payload,
  news: NewsWithSubscriptionFields
): Promise<string[]> {
  const newsCategories = (news.categories ?? []).map(getId).map(String)

  if (newsCategories.length === 0) {
    // Caller should broadcast to all — nothing to match here.
    return []
  }

  const newsDistrictId = news.district ? String(getId(news.district)) : null
  const newsLat = news.location?.latitude ?? null
  const newsLng = news.location?.longitude ?? null

  // Fetch ALL subscriptions that have at least one matching category.
  // We load in pages to handle large datasets.
  const matchedTokens = new Set<string>()
  let page = 1
  const PAGE_SIZE = 200

  while (true) {
    const result = await payload.find({
      collection: 'subscriptions',
      where: {
        'categories.id': { in: newsCategories },
      },
      depth: 1,
      limit: PAGE_SIZE,
      page,
    } as any)

    for (const sub of result.docs as unknown as SubscriptionDoc[]) {
      const tokenRef = sub.pushToken
      if (!tokenRef || typeof tokenRef === 'number' || typeof tokenRef === 'string') continue

      const tokenStr = tokenRef.token
      if (!tokenStr || !Expo.isExpoPushToken(tokenStr)) continue
      if (tokenRef.active === false) continue

      const filters = sub.locationFilters ?? []

      // No filters → matches any location
      if (filters.length === 0) {
        matchedTokens.add(tokenStr)
        continue
      }

      // In-process matching for 'all' and 'district' filters
      const inProcessMatch = filters.some((f) =>
        locationFilterMatches(f, newsDistrictId, newsLat, newsLng)
      )

      if (inProcessMatch) {
        matchedTokens.add(tokenStr)
        continue
      }

      // PostGIS matching for 'point' and 'area' filters (only when news has coords)
      if (newsLat !== null && newsLng !== null) {
        const pointFilters = filters.filter((f) => f.filterType === 'point')
        const areaFilters = filters.filter((f) => f.filterType === 'area')

        for (const pf of pointFilters) {
          if (pf.latitude === null || pf.latitude === undefined) continue
          if (pf.longitude === null || pf.longitude === undefined) continue
          if (!pf.radius) continue

          try {
            const rows = (await (payload.db as any).drizzle.execute(
              `SELECT ST_DWithin(
                ST_MakePoint(${newsLng}, ${newsLat})::geography,
                ST_MakePoint(${pf.longitude}, ${pf.latitude})::geography,
                ${pf.radius}
              ) AS match`
            )) as { rows: { match: boolean }[] }
            if (rows.rows?.[0]?.match) {
              matchedTokens.add(tokenStr)
              break
            }
          } catch (err) {
            payload.logger.warn(`PostGIS point check failed: ${err}`)
          }
        }

        if (matchedTokens.has(tokenStr)) continue

        for (const af of areaFilters) {
          if (!af.polygon) continue
          try {
            const polygonJson = JSON.stringify(af.polygon)
            const rows = (await (payload.db as any).drizzle.execute(
              `SELECT ST_Contains(
                ST_GeomFromGeoJSON('${polygonJson.replace(/'/g, "''")}'),
                ST_MakePoint(${newsLng}, ${newsLat})
              ) AS match`
            )) as { rows: { match: boolean }[] }
            if (rows.rows?.[0]?.match) {
              matchedTokens.add(tokenStr)
              break
            }
          } catch (err) {
            payload.logger.warn(`PostGIS area check failed: ${err}`)
          }
        }
      }
    }

    if (!result.hasNextPage) break
    page++
  }

  return Array.from(matchedTokens)
}
