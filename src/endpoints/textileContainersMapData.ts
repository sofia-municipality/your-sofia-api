import { sql } from '@payloadcms/db-postgres'
import type { Endpoint } from 'payload'

export const textileContainersMapData: Endpoint = {
  path: '/textile-containers',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    const minLat = parseFloat((req.query?.minLat as string) || '')
    const maxLat = parseFloat((req.query?.maxLat as string) || '')
    const minLng = parseFloat((req.query?.minLng as string) || '')
    const maxLng = parseFloat((req.query?.maxLng as string) || '')
    const hasBounds = !isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLng) && !isNaN(maxLng)

    try {
      const query = sql`
        SELECT
          tc.id,
          tc.number,
          tc.address,
          ST_AsGeoJSON(tc.location)::json as location,
          tc.status,
          tc.notes,
          tc.district_id,
          tc.company_id,
          tc.created_at,
          tc.updated_at,
          cd.district_id as district_number,
          cd.name as district_name,
          co.name as company_name,
          (
            SELECT COUNT(*) FROM signals sig
            WHERE sig.city_object_reference_id = tc.id::text
              AND sig.city_object_type = 'textile-container'
          )::int as signal_count,
          (
            SELECT COUNT(*) FROM signals sig
            WHERE sig.city_object_reference_id = tc.id::text
              AND sig.city_object_type = 'textile-container'
              AND sig.status NOT IN ('resolved', 'rejected')
          )::int as active_signal_count
        FROM textile_containers tc
        LEFT JOIN city_districts cd ON cd.id = tc.district_id
        LEFT JOIN textile_companies co ON co.id = tc.company_id
        ${
          hasBounds
            ? sql`WHERE tc.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`
            : sql``
        }
        ORDER BY tc.id ASC
      `

      const result = await payload.db.drizzle.execute(query)

      const totalResult = await payload.db.drizzle.execute(
        sql`SELECT COUNT(*)::int AS total FROM textile_containers`
      )
      const total = Number((totalResult.rows[0] as { total: number } | undefined)?.total ?? 0)

      type TextileRow = {
        id: number
        // `number` is a Postgres `numeric` column, which node-postgres returns
        // as a string to avoid precision loss — coerced below.
        number: string | null
        address: string
        location: { coordinates: [number, number] }
        status: string | null
        notes: string | null
        district_id: number | null
        company_id: number | null
        created_at: Date
        updated_at: Date
        district_number: number | null
        district_name: string | null
        company_name: string | null
        signal_count: number
        active_signal_count: number
      }

      const docs = (result.rows as TextileRow[]).map((row) => ({
        id: row.id,
        number: row.number === null ? null : Number(row.number),
        address: row.address,
        location: [row.location.coordinates[0], row.location.coordinates[1]] as [number, number],
        status: row.status,
        notes: row.notes,
        district: row.district_id,
        districtNumber: row.district_number,
        districtName: row.district_name,
        company: row.company_id,
        companyName: row.company_name,
        signalCount: row.signal_count,
        activeSignalCount: row.active_signal_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return Response.json({ docs, totalDocs: docs.length, total }, { status: 200 })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      payload.logger.error(`Error fetching textile containers map data: ${errorMessage}`)

      return Response.json(
        { error: 'Failed to fetch textile containers map data', details: errorMessage },
        { status: 500 }
      )
    }
  },
}
