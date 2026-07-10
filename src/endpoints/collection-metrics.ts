import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

const DEFAULT_DAYS = 7

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

export const collectionMetrics: Endpoint = {
  path: '/collection-metrics',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const now = new Date()
      const defaultFrom = new Date(now)
      defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DAYS)

      const from = parseDate(req.query?.from as string | undefined, defaultFrom)
      const to = parseDate(req.query?.to as string | undefined, now)

      const fromIso = from.toISOString()
      const toIso = to.toISOString()

      // ── District stats via SQL ──────────────────────────────────────────────
      // For each district: count all containers + count containers that had at
      // least one observation (cleaned) within the requested time window.
      // Joins city_districts to retrieve the numeric district_id and name.
      const districtQuery = sql`
        SELECT
          cd.district_id,
          cd.name         AS district_name,
          COUNT(DISTINCT wc.id)::int            AS total_containers,
          COUNT(DISTINCT wco.container_id)::int AS collected_containers
        FROM waste_containers wc
        JOIN city_districts cd ON cd.id = wc.district_id
        JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
        LEFT JOIN waste_container_observations wco
          ON  wco.container_id = wc.id
          AND wco.cleaned_at  >= ${fromIso}::timestamptz
          AND wco.cleaned_at  <= ${toIso}::timestamptz
        WHERE wc.district_id IS NOT NULL
          AND cd.code = 'RTR'
          AND wc.capacity_volume = 1.1
          AND wc.status IN ('active', 'full')
          AND wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text
        GROUP BY cd.district_id, cd.name
        ORDER BY cd.district_id
      `

      const districtResult = await payload.db.drizzle.execute(districtQuery)
      const districtRows = districtResult.rows as {
        district_id: number
        district_name: string
        total_containers: number
        collected_containers: number
      }[]

      const byDistrict = districtRows.map((row) => ({
        districtId: row.district_id,
        districtName: row.district_name ?? `District ${row.district_id}`,
        totalContainers: row.total_containers,
        collectedContainers: row.collected_containers,
      }))

      // ── Zone stats via SQL ───────────────────────────────────────────────────
      // Join waste_containers → city_districts → waste_collection_zones so we
      // can aggregate container and collection counts per zone directly.
      const zoneQuery = sql`
        SELECT
          wcz.id                                                  AS zone_id,
          wcz.number                                              AS zone_number,
          wcz.name                                                AS zone_name,
          wcz.service_company_id,
          COUNT(DISTINCT wc.id)::int                              AS total_containers,
          COUNT(DISTINCT wco.container_id)::int                   AS collected_containers
        FROM waste_collection_zones wcz
        LEFT JOIN city_districts cd ON cd.waste_collection_zone_id = wcz.id
        LEFT JOIN waste_containers wc ON wc.district_id = cd.id
        JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
        LEFT JOIN waste_container_observations wco
          ON  wco.container_id = wc.id
          AND wco.cleaned_at  >= ${fromIso}::timestamptz
          AND wco.cleaned_at  <= ${toIso}::timestamptz
        WHERE cd.code = 'RTR'
          AND wc.capacity_volume = 1.1
          AND wc.status IN ('active', 'full')
          AND wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text
        GROUP BY wcz.id, wcz.number, wcz.name, wcz.service_company_id
        ORDER BY wcz.number
      `

      const zoneResult = await payload.db.drizzle.execute(zoneQuery)
      const byZone = (
        zoneResult.rows as {
          zone_number: number
          zone_name: string
          service_company_id: number | null
          total_containers: number
          collected_containers: number
        }[]
      ).map((row) => ({
        zoneNumber: row.zone_number,
        zoneName: row.zone_name,
        serviceCompanyId: row.service_company_id ?? null,
        totalContainers: row.total_containers,
        collectedContainers: row.collected_containers,
      }))

      // ── Days-overdue histogram ─────────────────────────────────────────────
      // For each container, find its most recent scheduled pickup window (04:00
      // Sofia local time on the scheduled day-of-week within the last 7 days).
      // Containers cleaned after that window are "on time"; all others are
      // bucketed by how many hours have elapsed since their expected pickup.
      const histogramQuery = sql`
        WITH RECURSIVE last_7_days AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')::date AS check_date
          UNION ALL
          SELECT (check_date - INTERVAL '1 day')::date
          FROM last_7_days
          WHERE check_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')::date - INTERVAL '7 days'
        ),
        latest_expected AS (
          SELECT DISTINCT ON (wc.id)
            wc.id           AS container_id,
            wc.last_cleaned,
            (d.check_date::timestamp + TIME '04:00:00') AT TIME ZONE 'Europe/Sofia' AS expected_at
          FROM waste_containers wc
          JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
          CROSS JOIN last_7_days d
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          WHERE EXTRACT(ISODOW FROM d.check_date)::int = wcdow.value::text::int
            AND (d.check_date::timestamp + TIME '04:00:00') AT TIME ZONE 'Europe/Sofia' <= NOW()
            AND wc.status IN ('active', 'full')
            AND cd.code = 'RTR'
            AND wc.capacity_volume = 1.1
          ORDER BY wc.id, d.check_date DESC
        )
        SELECT
          CASE
            WHEN last_cleaned >= expected_at
              OR EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 24   THEN '<1 ден'
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 48   THEN '1-2 дни'
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 72   THEN '2-3 дни'
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 168  THEN '3-7 дни'
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 336  THEN '7-14 дни'
            ELSE '14+'
          END AS bucket,
          CASE
            WHEN last_cleaned >= expected_at
              OR EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 24   THEN 0
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 48   THEN 1
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 72   THEN 2
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 168  THEN 3
            WHEN EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 336  THEN 4
            ELSE 5
          END AS bucket_order,
          COUNT(*)::int AS container_count
        FROM latest_expected
        GROUP BY bucket, bucket_order
        ORDER BY bucket_order
      `

      const histogramResult = await payload.db.drizzle.execute(histogramQuery)
      const byTimeSinceCollection = (
        histogramResult.rows as { bucket: string; bucket_order: number; container_count: number }[]
      ).map((row) => ({
        bucket: row.bucket,
        bucketOrder: row.bucket_order,
        containerCount: row.container_count,
      }))

      // ── Daily trendline data (per day in range) ───────────────────────────
      // Returns one row per day with fixed total container count and
      // unique containers collected on that day.
      const dailyTrendQuery = sql`
        WITH day_series AS (
          SELECT generate_series(
            DATE_TRUNC('day', ${fromIso}::timestamptz)::date,
            DATE_TRUNC('day', ${toIso}::timestamptz)::date,
            INTERVAL '1 day'
          )::date AS day
        ),
        total_containers_by_dow AS (
          SELECT
            wcdow.value::text::int             AS dow,
            COUNT(DISTINCT wc.id)::int         AS total_containers
          FROM waste_containers wc
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
          WHERE cd.code = 'RTR'
            AND wc.capacity_volume = 1.1
            AND wc.status IN ('active', 'full')
          GROUP BY wcdow.value::text::int
        ),
        collected_per_day AS (
          SELECT
            (wco.cleaned_at AT TIME ZONE 'Europe/Sofia')::date AS day,
            COUNT(DISTINCT wco.container_id)::int              AS collected_containers
          FROM waste_container_observations wco
          JOIN waste_containers wc ON wc.id = wco.container_id
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          WHERE wco.cleaned_at >= ${fromIso}::timestamptz
            AND wco.cleaned_at <= ${toIso}::timestamptz
            AND cd.code = 'RTR'
            AND wc.capacity_volume = 1.1
            AND wc.status IN ('active', 'full')
          GROUP BY (wco.cleaned_at AT TIME ZONE 'Europe/Sofia')::date
        )
        SELECT
          ds.day::text                                                     AS day_iso,
          COALESCE(tc.total_containers, 0)::int                            AS total_containers,
          COALESCE(cpd.collected_containers, 0)::int                       AS collected_containers
        FROM day_series ds
        LEFT JOIN total_containers_by_dow tc ON tc.dow = EXTRACT(ISODOW FROM ds.day)::int
        LEFT JOIN collected_per_day cpd ON cpd.day = ds.day
        ORDER BY ds.day
      `

      const dailyTrendResult = await payload.db.drizzle.execute(dailyTrendQuery)
      const byDay = (
        dailyTrendResult.rows as {
          day_iso: string
          total_containers: number
          collected_containers: number
        }[]
      ).map((row) => ({
        date: row.day_iso,
        totalContainers: row.total_containers,
        collectedContainers: row.collected_containers,
      }))

      // ── Schedule compliance ─────────────────────────────────────────────────
      // For each container, find the most recently past scheduled collection day
      // (days_ago = 0 means today, 1 = yesterday, etc.) by picking the smallest
      // offset from today's ISO day-of-week back to each scheduled day.
      // delayed = not cleaned since that day AND that day was > 24 h ago
      // missed  = not cleaned since that day AND that day was > 36 h ago
      // Uses Sofia local time throughout to avoid day-boundary mismatch.
      const complianceQuery = sql`
        WITH RECURSIVE last_7_days AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')::date AS check_date
          UNION ALL
          SELECT (check_date - INTERVAL '1 day')::date
          FROM last_7_days
          WHERE check_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')::date - INTERVAL '7 days'
        ),
        scheduled_today_cte AS (
          SELECT COUNT(DISTINCT wc.id)::int AS scheduled_today
          FROM waste_containers wc
          JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          WHERE EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia'))::int = wcdow.value::text::int
            AND wc.status IN ('active', 'full')
            AND cd.code = 'RTR'
            AND wc.capacity_volume = 1.1
        ),
        latest_expected AS (
          SELECT DISTINCT ON (wc.id)
            wc.id          AS container_id,
            wc.last_cleaned,
            (d.check_date::timestamp + TIME '04:00:00') AT TIME ZONE 'Europe/Sofia' AS expected_at
          FROM waste_containers wc
          JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
          CROSS JOIN last_7_days d
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          WHERE EXTRACT(ISODOW FROM d.check_date)::int = wcdow.value::text::int
            AND (d.check_date::timestamp + TIME '04:00:00') AT TIME ZONE 'Europe/Sofia' <= NOW()
            AND wc.status IN ('active', 'full')
            AND cd.code = 'RTR'
            AND wc.capacity_volume = 1.1
          ORDER BY wc.id, d.check_date DESC
        )
        SELECT
          (SELECT scheduled_today FROM scheduled_today_cte)                         AS scheduled_today,
          COUNT(*) FILTER (
            WHERE (last_cleaned IS NULL OR last_cleaned < expected_at)
              AND EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 >= 24
              AND EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 < 36
          )::int                                                                     AS delayed,
          COUNT(*) FILTER (
            WHERE (last_cleaned IS NULL OR last_cleaned < expected_at)
              AND EXTRACT(EPOCH FROM (NOW() - expected_at)) / 3600 >= 36
          )::int                                                                     AS missed
        FROM latest_expected
      `

      const complianceResult = await payload.db.drizzle.execute(complianceQuery)
      const complianceRow = (
        complianceResult.rows as { scheduled_today: number; delayed: number; missed: number }[]
      )[0] ?? { scheduled_today: 0, delayed: 0, missed: 0 }

      const scheduleCompliance = {
        scheduledToday: complianceRow.scheduled_today,
        delayed: complianceRow.delayed,
        missed: complianceRow.missed,
      }

      return Response.json({
        from: fromIso,
        to: toIso,
        byDistrict,
        byZone,
        byDay,
        byTimeSinceCollection,
        scheduleCompliance,
      })
    } catch (error) {
      console.error('Error fetching collection metrics:', error)
      return Response.json(
        {
          error: 'Failed to fetch collection metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}
