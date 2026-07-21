import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { canViewFountains } from '@/access/cityInfrastructureAdmin'

/**
 * GET /api/drinking-fountains/map-data
 * Returns all drinking fountains (optionally within a bounding box) with their
 * lookup values resolved to names — powers the admin fountains map. The dataset
 * is small, so it is returned in a single response and filtered client-side.
 */
export const fountainsMapData: Endpoint = {
  path: '/map-data',
  method: 'get',
  handler: async (req) => {
    const { payload, user } = req

    if (!canViewFountains({ req } as Parameters<typeof canViewFountains>[0])) {
      return Response.json({ error: 'Forbidden' }, { status: user ? 403 : 401 })
    }

    const minLat = parseFloat((req.query?.minLat as string) || '')
    const maxLat = parseFloat((req.query?.maxLat as string) || '')
    const minLng = parseFloat((req.query?.minLng as string) || '')
    const maxLng = parseFloat((req.query?.maxLng as string) || '')
    const hasBounds = !isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLng) && !isNaN(maxLng)

    try {
      const db = payload.db

      const query = sql`
        SELECT
          df.id,
          df.public_number,
          df.address,
          ST_AsGeoJSON(df.location)::json as location,
          df.is_active,
          df.protection_status,
          df.external_link,
          df.created_at,
          df.updated_at,
          df.district_id,
          df.source_id,
          df.status_id,
          df.owner_id,
          df.activation_type_id,
          cd.district_id as district_number,
          cd.name as district_name,
          s.name as source_name,
          st.name as status_name,
          o.name as owner_name,
          act.name as activation_name,
          (
            SELECT COUNT(*) FROM signals sig
            WHERE sig.city_object_reference_id = df.public_number
              AND sig.city_object_type = 'drinking-fountain'
          )::int as signal_count,
          (
            SELECT COUNT(*) FROM signals sig
            WHERE sig.city_object_reference_id = df.public_number
              AND sig.city_object_type = 'drinking-fountain'
              AND sig.status NOT IN ('resolved', 'rejected')
          )::int as active_signal_count
        FROM drinking_fountains df
        LEFT JOIN city_districts cd ON cd.id = df.district_id
        LEFT JOIN drinking_fountain_source s ON s.id = df.source_id
        LEFT JOIN fountain_status st ON st.id = df.status_id
        LEFT JOIN fountain_owner o ON o.id = df.owner_id
        LEFT JOIN fountain_activation_type act ON act.id = df.activation_type_id
        ${
          hasBounds
            ? sql`WHERE df.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`
            : sql``
        }
        ORDER BY df.id ASC
      `

      const result = await db.drizzle.execute(query)

      // Grand total of all fountains (ignores the viewport bounds) so the UI can
      // show "N shown of TOTAL" rather than "N of N" when the map is zoomed in.
      const totalResult = await db.drizzle.execute(
        sql`SELECT COUNT(*)::int AS total FROM drinking_fountains`
      )
      const total = Number((totalResult.rows[0] as { total: number } | undefined)?.total ?? 0)

      type FountainRow = {
        id: number
        public_number: string | null
        address: string
        location: { coordinates: [number, number] }
        is_active: boolean | null
        protection_status: string | null
        external_link: string | null
        created_at: Date
        updated_at: Date
        district_id: number | null
        source_id: number | null
        status_id: number | null
        owner_id: number | null
        activation_type_id: number | null
        district_number: number | null
        district_name: string | null
        source_name: string | null
        status_name: string | null
        owner_name: string | null
        activation_name: string | null
        signal_count: number
        active_signal_count: number
      }

      const docs = (result.rows as FountainRow[]).map((row) => ({
        id: row.id,
        publicNumber: row.public_number,
        address: row.address,
        location: [row.location.coordinates[0], row.location.coordinates[1]] as [number, number],
        isActive: row.is_active,
        protectionStatus: row.protection_status,
        externalLink: row.external_link,
        district: row.district_id,
        districtNumber: row.district_number,
        districtName: row.district_name,
        source: row.source_id,
        sourceName: row.source_name,
        status: row.status_id,
        statusName: row.status_name,
        owner: row.owner_id,
        ownerName: row.owner_name,
        activationType: row.activation_type_id,
        activationName: row.activation_name,
        signalCount: row.signal_count,
        activeSignalCount: row.active_signal_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return Response.json({ docs, totalDocs: docs.length, total }, { status: 200 })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      payload.logger.error(`Error fetching fountains map data: ${errorMessage}`)

      return Response.json(
        { error: 'Failed to fetch fountains map data', details: errorMessage },
        { status: 500 }
      )
    }
  },
}
