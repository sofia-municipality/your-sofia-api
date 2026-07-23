import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

const supportedObjectTypes = ['waste-container'] as const
type SupportedObjectType = (typeof supportedObjectTypes)[number]

const getObjectType = (req: Parameters<Endpoint['handler']>[0]) => {
  const objectType = (req.query?.objectType as string | undefined) ?? 'waste-container'
  if (supportedObjectTypes.includes(objectType as SupportedObjectType)) {
    return objectType as SupportedObjectType
  }
  return null
}

const invalidObjectTypeResponse = () =>
  Response.json(
    {
      error: 'Invalid object type',
      details: `objectType must be one of: ${supportedObjectTypes.join(', ')}`,
    },
    { status: 400 }
  )

export const signalsAgeMetric: Endpoint = {
  path: '/signals-age-metric',
  method: 'get',
  handler: async (req) => {
    const { payload } = req
    const objectType = getObjectType(req)
    if (!objectType) return invalidObjectTypeResponse()

    try {
      const query = sql`
        WITH signal_objects AS (
          -- Waste containers
          SELECT
            s.created_at,
            wc.district_id AS district
          FROM signals s
          JOIN waste_containers wc
            ON s.city_object_type = ${objectType}
           AND wc.public_number = s.city_object_reference_id
          WHERE s.status NOT IN ('resolved', 'rejected')

          -- TODO - when DF are merged if they use the same signals logic
          -- UNION ALL

          -- -- Drinking fountains
          -- SELECT
          --   s.created_at,
          --   df.district_id AS district
          -- FROM signals s
          -- JOIN drinking_fountains df
          --   ON s.city_object_type = 'drinking-fountain'
          --  AND df.public_number = s.city_object_reference_id
          -- WHERE s.status NOT IN ('resolved', 'rejected')
        ),
        bucketed AS (
          SELECT
            CASE
              WHEN NOW() - created_at < INTERVAL '1 day' THEN '<1 ден'
              WHEN NOW() - created_at < INTERVAL '2 days' THEN '1-2 дни'
              WHEN NOW() - created_at < INTERVAL '3 days' THEN '2-3 дни'
              WHEN NOW() - created_at < INTERVAL '7 days' THEN '3-7 дни'
              WHEN NOW() - created_at < INTERVAL '14 days' THEN '7-14 дни'
              ELSE '14+'
            END AS bucket,
            CASE
              WHEN NOW() - created_at < INTERVAL '1 day' THEN 0
              WHEN NOW() - created_at < INTERVAL '2 days' THEN 1
              WHEN NOW() - created_at < INTERVAL '3 days' THEN 2
              WHEN NOW() - created_at < INTERVAL '7 days' THEN 3
              WHEN NOW() - created_at < INTERVAL '14 days' THEN 4
              ELSE 5
            END AS bucket_order,
            district
          FROM signal_objects
        ),
        district_counts AS (
          SELECT
            bucket,
            bucket_order,
            district,
            COUNT(*)::int AS count
          FROM bucketed
          GROUP BY bucket, bucket_order, district
        )
        SELECT
          dc.bucket,
          dc.bucket_order,
          SUM(dc.count)::int AS count,
          json_agg(
            json_build_object(
              'id', dc.district,
              'name', cd.name,
              'count', dc.count
            )
            ORDER BY dc.count DESC, cd.name
          ) AS districts
        FROM district_counts dc
        LEFT JOIN city_districts cd
          ON cd.id = dc.district
        GROUP BY dc.bucket, dc.bucket_order
        ORDER BY dc.bucket_order;
      `

      const result = await payload.db.drizzle.execute(query)

      return Response.json({
        data: result.rows,
      })
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
    const objectType = getObjectType(req)

    if (!objectType) return invalidObjectTypeResponse()

    try {
      const query = sql`
        WITH status_district_counts AS (
          SELECT
            s.status,
            wc.district_id AS district,
            COUNT(*)::int AS count
          FROM signals s
          JOIN waste_containers wc
            ON s.city_object_type = ${objectType}
           AND wc.public_number = s.city_object_reference_id
          GROUP BY s.status, wc.district_id
        )
        SELECT
          sdc.status,
          SUM(sdc.count)::int AS count,
          CASE sdc.status
            WHEN 'pending' THEN 0
            WHEN 'in-progress' THEN 1
            WHEN 'resolved' THEN 2
            WHEN 'rejected' THEN 3
            ELSE 4
          END AS status_order,
          json_agg(
            json_build_object(
              'id', sdc.district,
              'name', cd.name,
              'count', sdc.count
            )
            ORDER BY sdc.count DESC, cd.name
          ) AS districts
        FROM status_district_counts sdc
        LEFT JOIN city_districts cd ON cd.id = sdc.district
        GROUP BY sdc.status
        ORDER BY status_order
      `

      const result = await payload.db.drizzle.execute(query)

      return Response.json({ data: result.rows })
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
    const objectType = getObjectType(req)

    if (!objectType) return invalidObjectTypeResponse()

    try {
      const query = sql`
        WITH state_district_counts AS (
          SELECT
            scs.value::text AS container_state,
            wc.district_id AS district,
            COUNT(*)::int AS count
          FROM signals s
          JOIN waste_containers wc
            ON s.city_object_type = ${objectType}
           AND wc.public_number = s.city_object_reference_id
          JOIN signals_container_state scs ON scs.parent_id = s.id
          WHERE s.status NOT IN ('resolved', 'rejected')
          GROUP BY scs.value, wc.district_id
        )
        SELECT
          sdc.container_state,
          SUM(sdc.count)::int AS count,
          json_agg(
            json_build_object(
              'id', sdc.district,
              'name', cd.name,
              'count', sdc.count
            )
            ORDER BY sdc.count DESC, cd.name
          ) AS districts
        FROM state_district_counts sdc
        LEFT JOIN city_districts cd ON cd.id = sdc.district
        GROUP BY sdc.container_state
        ORDER BY count DESC
      `

      const result = await payload.db.drizzle.execute(query)

      return Response.json({ data: result.rows })
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
