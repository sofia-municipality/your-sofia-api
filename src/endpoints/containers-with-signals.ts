import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

/**
 * Custom endpoint to fetch waste containers with aggregated signal counts
 * Uses raw SQL for maximum performance - single database call
 */
export const containersWithSignalCount: Endpoint = {
  path: '/containers-with-signal-count',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const limit = parseInt((req.query?.limit as string) || '1000')
      const page = parseInt((req.query?.page as string) || '1')
      const offset = (page - 1) * limit

      const db = payload.db

      // Single SQL query to fetch containers with signal counts
      const query = sql`
        WITH container_signals AS (
          SELECT
            wc.*,
            COALESCE(COUNT(s.id), 0)::int AS signal_count,
            COALESCE(COUNT(s.id) FILTER (
              WHERE s.status NOT IN ('resolved', 'rejected')
            ), 0)::int AS active_signal_count
          FROM waste_containers wc
          LEFT JOIN signals s ON (
            s.city_object_reference_id = wc.public_number
            AND s.city_object_type = 'waste-container'
          )
          GROUP BY wc.id
          ORDER BY active_signal_count DESC
          LIMIT ${limit} OFFSET ${offset}
        ),
        total AS (
          SELECT COUNT(*)::int as total_count
          FROM waste_containers
        )
        SELECT 
          cs.*,
          t.total_count
        FROM container_signals cs
        CROSS JOIN total t
      `

      const resultRows = await db.drizzle.execute(query)

      const rows = resultRows.rows as any[]
      const totalDocs = rows[0]?.total_count || 0
      const totalPages = Math.ceil(totalDocs / limit)

      // Transform to match Payload response format
      const docs = rows.map((row) => ({
        id: row.id,
        legacyId: row.legacy_id,
        publicNumber: row.public_number,
        image: row.image,
        images: row.images,
        location: row.location,
        capacitySize: row.capacity_size,
        capacityVolume: row.capacity_volume,
        wasteType: row.waste_type,
        status: row.status,
        servicedBy: row.serviced_by,
        serviceInterval: row.service_interval,
        lastServicedAt: row.last_serviced_at,
        state: row.state,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        signalCount: row.signal_count,
        activeSignalCount: row.active_signal_count,
      }))

      return Response.json({
        docs,
        totalDocs,
        limit,
        totalPages,
        page,
        pagingCounter: offset + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      })
    } catch (error) {
      console.error('Error fetching containers with signals:', error)
      return Response.json(
        {
          error: 'Failed to fetch containers with signal counts',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}
