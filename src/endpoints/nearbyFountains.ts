import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

/**
 * GET /api/drinking-fountains/nearby
 * Returns drinking fountains within `radius` meters of a point, nearest first.
 * Mirrors the waste-containers `/nearby` endpoint.
 */
export const nearbyFountains: Endpoint = {
  path: '/nearby',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    const latitude = parseFloat((req.query?.latitude as string) || '')
    const longitude = parseFloat((req.query?.longitude as string) || '')
    const radius = parseFloat((req.query?.radius as string) || '300') // Default 300 meters
    const onlyActive = req.query?.onlyActive === 'true'
    const limit = parseInt((req.query?.limit as string) || '100', 10)

    if (isNaN(latitude) || isNaN(longitude)) {
      return Response.json(
        { error: 'Invalid or missing latitude/longitude parameters' },
        { status: 400 }
      )
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return Response.json(
        { error: 'Latitude must be between -90 and 90, longitude between -180 and 180' },
        { status: 400 }
      )
    }

    if (radius <= 0 || radius > 10000) {
      return Response.json({ error: 'Radius must be between 0 and 10000 meters' }, { status: 400 })
    }

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
          )::int as active_signal_count,
          ST_Distance(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            df.location
          ) as distance
        FROM drinking_fountains df
        LEFT JOIN city_districts cd ON cd.id = df.district_id
        LEFT JOIN drinking_fountain_source s ON s.id = df.source_id
        LEFT JOIN fountain_status st ON st.id = df.status_id
        LEFT JOIN fountain_owner o ON o.id = df.owner_id
        LEFT JOIN fountain_activation_type act ON act.id = df.activation_type_id
        WHERE ST_DWithin(
          ST_MakePoint(${longitude}, ${latitude})::geography,
          df.location,
          ${radius}
        )
        ${onlyActive ? sql`AND df.is_active IS TRUE` : sql``}
        ORDER BY distance ASC
        LIMIT ${limit}
      `

      const result = await db.drizzle.execute(query)

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
        distance: number
      }

      const fountains = (result.rows as FountainRow[]).map((row) => ({
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
        distance: Math.round(row.distance),
      }))

      return Response.json(
        {
          docs: fountains,
          totalDocs: fountains.length,
          limit,
          page: 1,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
        { status: 200 }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      payload.logger.error(`Error fetching nearby fountains: ${errorMessage}`)

      return Response.json(
        { error: 'Failed to fetch nearby fountains', details: errorMessage },
        { status: 500 }
      )
    }
  },
}
