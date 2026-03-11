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

      // ── Zone stats — derived from WasteCollectionZones ────────────────────
      const zonesResult = await payload.find({
        collection: 'waste-collection-zones',
        limit: 20,
        sort: 'number',
        overrideAccess: true,
      })

      // Build a lookup: districtId → district stats
      const districtMap = new Map(byDistrict.map((d) => [d.districtId, d]))

      const byZone = zonesResult.docs.map((zone) => {
        const districts = (zone.districts ?? []) as string[]
        let totalContainers = 0
        let collectedContainers = 0
        for (const districtId of districts) {
          const d = districtMap.get(districtId)
          if (d) {
            totalContainers += d.totalContainers
            collectedContainers += d.collectedContainers
          }
        }
        return {
          zoneNumber: zone.number,
          zoneName: zone.name,
          serviceCompanyId: zone.serviceCompanyId ?? null,
          totalContainers,
          collectedContainers,
        }
      })

      // ── Time-since-last-collection histogram ───────────────────────────────
      // LEFT JOIN from all containers so that those with no observations at all
      // land in the "never" bucket (last_cleaned_at IS NULL).
      const histogramQuery = sql`
        WITH last_coll AS (
          SELECT
            wc.id AS container_id,
            MAX(wco.cleaned_at) AS last_cleaned_at
          FROM waste_containers wc
          LEFT JOIN waste_container_observations wco ON wco.container_id = wc.id
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
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 24  THEN 1
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 48  THEN 2
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 72  THEN 3
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 168 THEN 4
            WHEN EXTRACT(EPOCH FROM (NOW() - last_cleaned_at)) / 3600 < 336 THEN 5
            WHEN last_cleaned_at IS NULL                                    THEN 10
            ELSE 6
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

      return Response.json({
        from: fromIso,
        to: toIso,
        byDistrict,
        byZone,
        byTimeSinceCollection,
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
