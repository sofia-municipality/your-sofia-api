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
        LEFT JOIN waste_container_observations wco
          ON  wco.container_id = wc.id
          AND wco.cleaned_at  >= ${fromIso}::timestamptz
          AND wco.cleaned_at  <= ${toIso}::timestamptz
        WHERE wc.district_id IS NOT NULL
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
        districtId: String(row.district_id),
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
        LEFT JOIN waste_container_observations wco
          ON  wco.container_id = wc.id
          AND wco.cleaned_at  >= ${fromIso}::timestamptz
          AND wco.cleaned_at  <= ${toIso}::timestamptz
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

      // ── Time-since-last-collection histogram ───────────────────────────────
      // LEFT JOIN from all containers so that those with no observations at all
      // land in the "never" bucket (last_cleaned_at IS NULL).
      const histogramQuery = sql`
        WITH last_coll AS (
          SELECT
            wc.id AS container_id,
            MAX(wc.last_cleaned) AS last_cleaned_at
          FROM waste_containers wc
          GROUP BY wc.id
        )
        SELECT
          CASE
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 24  THEN '<1'
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 48  THEN '1-2'
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 72  THEN '2-3'
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 168 THEN '3-7'
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 336 THEN '7-14'
            WHEN last_cleaned_at IS NULL                                    THEN 'N/A'
            ELSE '14+'
          END AS bucket,
          CASE
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 24  THEN 0
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 48  THEN 1
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 72  THEN 2
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 168 THEN 3
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 336 THEN 4
            WHEN last_cleaned_at IS NULL                                    THEN 10
            ELSE 5
          END AS bucket_order,
          COUNT(*)::int AS container_count
        FROM last_coll
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

      // ── Schedule compliance ─────────────────────────────────────────────────
      // Counts containers scheduled for today that are delayed (>24h) or missed (>36h).
      // Uses Sofia local time (Europe/Sofia = UTC+2/+3) to avoid day boundary mismatch.
      const complianceQuery = sql`
        SELECT
          COUNT(DISTINCT wc.id) FILTER (
            WHERE wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text
          )::int AS scheduled_today,
          COUNT(DISTINCT wc.id) FILTER (
            WHERE wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text
            AND (wc.last_cleaned IS NULL OR wc.last_cleaned < NOW() - INTERVAL '24 hours')
          )::int AS delayed,
          COUNT(DISTINCT wc.id) FILTER (
            WHERE wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text
            AND (wc.last_cleaned IS NULL OR wc.last_cleaned < NOW() - INTERVAL '36 hours')
          )::int AS missed
        FROM waste_containers wc
        LEFT JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id
        WHERE wc.status = 'active'
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
