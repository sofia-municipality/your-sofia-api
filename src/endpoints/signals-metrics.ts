import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

export const signalsAgeMetric: Endpoint = {
  path: '/signals-age-metric',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const query = sql`
        SELECT
          CASE
            WHEN NOW() - created_at < INTERVAL '1 day'  THEN '<1 ден'
            WHEN NOW() - created_at < INTERVAL '2 days' THEN '1-2 дни'
            WHEN NOW() - created_at < INTERVAL '3 days' THEN '2-3 дни'
            WHEN NOW() - created_at < INTERVAL '7 days' THEN '3-7 дни'
            WHEN NOW() - created_at < INTERVAL '14 days' THEN '7-14 дни'
            ELSE '14+'
          END AS bucket,
          CASE
            WHEN NOW() - created_at < INTERVAL '1 day'  THEN 0
            WHEN NOW() - created_at < INTERVAL '2 days' THEN 1
            WHEN NOW() - created_at < INTERVAL '3 days' THEN 2
            WHEN NOW() - created_at < INTERVAL '7 days' THEN 3
            WHEN NOW() - created_at < INTERVAL '14 days' THEN 4
            ELSE 5
          END AS bucket_order,
          COUNT(*)::int AS count
        FROM signals
        WHERE status NOT IN ('resolved', 'rejected')
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
      `

      const result = await payload.db.drizzle.execute(query)
      const rows = result.rows as { bucket: string; bucket_order: number; count: number }[]

      return Response.json({ data: rows })
    } catch (error) {
      console.error('Error fetching signals age metric:', error)
      return Response.json(
        {
          error: 'Failed to fetch signals age metric',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}

export const signalsStatusMetric: Endpoint = {
  path: '/signals-status-metric',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const query = sql`
        SELECT
          status,
          COUNT(*)::int AS count,
          CASE status
            WHEN 'pending' THEN 0
            WHEN 'in-progress' THEN 1
            WHEN 'resolved' THEN 2
            WHEN 'rejected' THEN 3
            ELSE 4
          END AS status_order
        FROM signals
        GROUP BY status
        ORDER BY status_order
      `

      const result = await payload.db.drizzle.execute(query)
      const rows = result.rows as { status: string; count: number; status_order: number }[]

      return Response.json({ data: rows })
    } catch (error) {
      console.error('Error fetching signals status metric:', error)
      return Response.json(
        {
          error: 'Failed to fetch signals status metric',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}

export const signalsActiveContainerStateMetric: Endpoint = {
  path: '/signals-active-container-state-metric',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const query = sql`
        SELECT
          scs.value::text AS container_state,
          COUNT(*)::int AS count
        FROM signals s
        JOIN signals_container_state scs ON scs.parent_id = s.id
        WHERE s.status NOT IN ('resolved', 'rejected')
          AND s.category = 'waste-container'
        GROUP BY scs.value
        ORDER BY count DESC
      `

      const result = await payload.db.drizzle.execute(query)
      const rows = result.rows as { container_state: string; count: number }[]

      return Response.json({ data: rows })
    } catch (error) {
      console.error('Error fetching active signals by container state metric:', error)
      return Response.json(
        {
          error: 'Failed to fetch active signals by container state metric',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}
