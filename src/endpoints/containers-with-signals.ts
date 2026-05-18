import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

// Zoom level at which we switch from clusters to individual markers
const INDIVIDUAL_ZOOM = 16

// Grid cell size in degrees for each zoom level (ST_SnapToGrid clustering)
function getGridSize(zoom: number): number {
  const sizes: Record<number, number> = {
    10: 0.5,
    11: 0.25,
    12: 0.1,
    13: 0.05,
    14: 0.02,
    15: 0.01,
  }
  return sizes[Math.min(Math.max(zoom, 10), 15)] ?? 0.5
}

export const containersWithSignalCount: Endpoint = {
  path: '/containers-with-signal-count',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    try {
      const zoom = parseInt((req.query?.zoom as string) || '12')
      const minLat = parseFloat((req.query?.minLat as string) || '')
      const maxLat = parseFloat((req.query?.maxLat as string) || '')
      const minLng = parseFloat((req.query?.minLng as string) || '')
      const maxLng = parseFloat((req.query?.maxLng as string) || '')
      const hasBounds = !isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLng) && !isNaN(maxLng)

      const allowedStatuses = ['active', 'full', 'maintenance', 'inactive', 'pending']
      const allowedWasteTypes = [
        'general',
        'recyclables',
        'organic',
        'glass',
        'paper',
        'plastic',
        'metal',
        'trashCan',
      ]

      // Support both legacy ?status=x and new ?statuses=a,b,c
      const statusesParam = (req.query?.statuses as string) || (req.query?.status as string) || ''
      const statuses = statusesParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => allowedStatuses.includes(s))

      const wasteTypes = ((req.query?.wasteTypes as string) || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => allowedWasteTypes.includes(s))

      const districtIdRaw = parseInt((req.query?.districtId as string) || '', 10)
      const districtId = isNaN(districtIdRaw) ? null : districtIdRaw

      const zoneNumberRaw = parseInt((req.query?.zoneNumber as string) || '', 10)
      const zoneNumber = isNaN(zoneNumberRaw) ? null : zoneNumberRaw
      const serviceCompanyIdRaw = parseInt((req.query?.serviceCompanyId as string) || '', 10)
      const serviceCompanyId = isNaN(serviceCompanyIdRaw) ? null : serviceCompanyIdRaw
      const lastCleanedFrom = (req.query?.lastCleanedFrom as string) || null
      const lastCleanedTo = (req.query?.lastCleanedTo as string) || null
      const lastCleanedIsNull = req.query?.lastCleanedIsNull === 'true'
      const scheduledToday = req.query?.scheduledToday === 'true'
      const scheduleCategory = (req.query?.scheduleCategory as string | undefined) ?? null
      const allowedScheduleCategories = ['onTime', 'delayed', 'missed']
      const scheduleCategoryValid =
        scheduleCategory && allowedScheduleCategories.includes(scheduleCategory)
          ? scheduleCategory
          : null

      const hasActiveSignals = req.query?.hasActiveSignals === 'true'
      const signalStatus = (req.query?.signalStatus as string | undefined) ?? null
      const allowedSignalStatuses = ['pending', 'in-progress', 'resolved', 'rejected']
      const signalStatusValid =
        signalStatus && allowedSignalStatuses.includes(signalStatus) ? signalStatus : null

      const signalContainerState = (req.query?.signalContainerState as string | undefined) ?? null
      const allowedSignalContainerStates = [
        'full',
        'dirty',
        'damaged',
        'leaves',
        'maintenance',
        'bagged',
        'fallen',
        'bulkyWaste',
      ]
      const signalContainerStateValid =
        signalContainerState && allowedSignalContainerStates.includes(signalContainerState)
          ? signalContainerState
          : null

      const signalAgeBucket = (req.query?.signalAgeBucket as string | undefined) ?? null
      const allowedSignalAgeBuckets = ['<1 ден', '1-2 дни', '2-3 дни', '3-7 дни', '7-14 дни', '14+']
      const signalAgeBucketValid =
        signalAgeBucket && allowedSignalAgeBuckets.includes(signalAgeBucket)
          ? signalAgeBucket
          : null

      const createdFrom = (req.query?.createdFrom as string) || null
      const createdTo = (req.query?.createdTo as string) || null

      const db = payload.db

      const boundsFilter = hasBounds
        ? sql`AND wc.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`
        : sql``
      const statusFilter =
        statuses.length > 0
          ? sql`AND wc.status::text IN (${sql.join(
              statuses.map((s) => sql`${s}`),
              sql`, `
            )})`
          : sql``
      const wasteTypeFilter =
        wasteTypes.length > 0
          ? sql`AND wc.waste_type::text IN (${sql.join(
              wasteTypes.map((s) => sql`${s}`),
              sql`, `
            )})`
          : sql``
      const districtFilter = districtId !== null ? sql`AND wc.district_id = ${districtId}` : sql``
      const activeSignalsFilter = hasActiveSignals
        ? sql`AND EXISTS (
            SELECT 1 FROM signals s2
            WHERE s2.city_object_reference_id = wc.public_number
              AND s2.city_object_type = 'waste-container'
              AND s2.status NOT IN ('resolved', 'rejected')
          )`
        : sql``
      const createdFromFilter = createdFrom
        ? sql`AND wc.created_at >= ${createdFrom}::timestamptz`
        : sql``
      const createdToFilter = createdTo ? sql`AND wc.created_at < ${createdTo}::timestamptz` : sql``
      const zoneFilter = zoneNumber !== null ? sql`AND wcz.number = ${zoneNumber}` : sql``
      const serviceCompanyFilter =
        serviceCompanyId !== null ? sql`AND wcz.service_company_id = ${serviceCompanyId}` : sql``
      const lastCleanedFromFilter = lastCleanedFrom
        ? sql`AND wc.last_cleaned >= ${lastCleanedFrom}::timestamptz`
        : sql``
      const lastCleanedToFilter = lastCleanedTo
        ? sql`AND wc.last_cleaned < ${lastCleanedTo}::timestamptz`
        : sql``
      const lastCleanedNullFilter = lastCleanedIsNull ? sql`AND wc.last_cleaned IS NULL` : sql``
      const scheduledTodayFilter = scheduledToday
        ? sql`AND wcdow.value::text = EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/Sofia')::int::text`
        : sql``
      const scheduleCategoryFilter =
        scheduleCategoryValid === 'onTime'
          ? sql`AND wc.last_cleaned >= NOW() - INTERVAL '24 hours'`
          : scheduleCategoryValid === 'delayed'
            ? sql`AND wc.last_cleaned < NOW() - INTERVAL '24 hours' AND wc.last_cleaned >= NOW() - INTERVAL '36 hours'`
            : scheduleCategoryValid === 'missed'
              ? sql`AND (wc.last_cleaned IS NULL OR wc.last_cleaned < NOW() - INTERVAL '36 hours')`
              : sql``
      const signalStatusFilter = signalStatusValid
        ? sql`AND EXISTS (
            SELECT 1
            FROM signals s2
            WHERE s2.city_object_reference_id = wc.public_number
              AND s2.city_object_type = 'waste-container'
              AND s2.status = ${signalStatusValid}
          )`
        : sql``
      const signalContainerStateFilter = signalContainerStateValid
        ? sql`AND EXISTS (
            SELECT 1
            FROM signals s2
            JOIN signals_container_state scs ON scs.parent_id = s2.id
            WHERE s2.city_object_reference_id = wc.public_number
              AND s2.city_object_type = 'waste-container'
              AND s2.status NOT IN ('resolved', 'rejected')
              AND scs.value = ${signalContainerStateValid}
          )`
        : sql``
      const signalAgeBucketFilter = signalAgeBucketValid
        ? sql`
            AND EXISTS (
              SELECT 1
              FROM signals s2
              WHERE s2.city_object_reference_id = wc.public_number
                AND s2.city_object_type = 'waste-container'
                AND (
                  CASE
                    WHEN NOW() - s2.created_at < INTERVAL '1 day' THEN '<1 ден'
                    WHEN NOW() - s2.created_at < INTERVAL '2 days' THEN '1-2 дни'
                    WHEN NOW() - s2.created_at < INTERVAL '3 days' THEN '2-3 дни'
                    WHEN NOW() - s2.created_at < INTERVAL '7 days' THEN '3-7 дни'
                    WHEN NOW() - s2.created_at < INTERVAL '14 days' THEN '7-14 дни'
                    ELSE '14+'
                  END
                ) = ${signalAgeBucketValid}
            )`
        : sql``
      const scheduleJoin = scheduledToday
        ? sql`LEFT JOIN waste_containers_collection_days_of_week wcdow ON wcdow.parent_id = wc.id`
        : sql``

      if (zoom >= INDIVIDUAL_ZOOM) {
        // Return individual markers for the visible viewport (capped at 2000)
        const limit = 2000
        const query = sql`
          SELECT
            wc.id,
            wc.legacy_id,
            wc.public_number,
            wc.image_id,
            ST_X(wc.location::geometry)::float AS longitude,
            ST_Y(wc.location::geometry)::float AS latitude,
            wc.capacity_size,
            wc.capacity_volume,
            wc.waste_type,
            wc.status,
            wc.serviced_by,
            wc.notes,
            wc.address,
            wc.last_cleaned,
            wc.bin_count,
            wc.district_id,
            wc.source,
            ARRAY(
              SELECT wcs.value::text FROM waste_containers_state wcs
              WHERE wcs.parent_id = wc.id ORDER BY wcs.order
            ) AS state,
            ARRAY(
              SELECT wcd.value::text FROM waste_containers_collection_days_of_week wcd
              WHERE wcd.parent_id = wc.id ORDER BY wcd.order
            ) AS collection_days_of_week,
            wc.collection_times_per_day,
            wc.schedule_source,
            wc.created_at,
            wc.updated_at,
            COALESCE(COUNT(s.id), 0)::int AS signal_count,
            COALESCE(COUNT(s.id) FILTER (
              WHERE s.status NOT IN ('resolved', 'rejected')
            ), 0)::int AS active_signal_count
          FROM waste_containers wc
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          LEFT JOIN waste_collection_zones wcz ON wcz.id = cd.waste_collection_zone_id
          ${scheduleJoin}
          LEFT JOIN signals s ON (
            s.city_object_reference_id = wc.public_number
            AND s.city_object_type = 'waste-container'
          )
          WHERE wc.location IS NOT NULL
            ${boundsFilter}
            ${statusFilter}
            ${wasteTypeFilter}
            ${districtFilter}
            ${zoneFilter}
            ${serviceCompanyFilter}
            ${activeSignalsFilter}
            ${createdFromFilter}
            ${createdToFilter}
            ${lastCleanedFromFilter}
            ${lastCleanedToFilter}
            ${lastCleanedNullFilter}
            ${scheduledTodayFilter}
            ${scheduleCategoryFilter}
            ${signalStatusFilter}
            ${signalContainerStateFilter}
            ${signalAgeBucketFilter}
          GROUP BY wc.id
          ORDER BY active_signal_count DESC
          LIMIT ${limit}
        `

        const resultRows = await db.drizzle.execute(query)
        const rows = resultRows.rows as Record<string, unknown>[]

        const docs = rows.map((row) => ({
          type: 'marker' as const,
          id: row.id,
          legacyId: row.legacy_id,
          publicNumber: row.public_number,
          imageId: row.image_id,
          location: [Number(row.longitude), Number(row.latitude)] as [number, number],
          capacitySize: row.capacity_size,
          capacityVolume: row.capacity_volume,
          wasteType: row.waste_type,
          status: row.status,
          servicedBy: row.serviced_by,
          notes: row.notes,
          address: row.address,
          lastCleaned: row.last_cleaned,
          binCount: row.bin_count,
          districtId: row.district_id,
          source: row.source,
          state: (row.state as string[] | null) ?? [],
          collectionDaysOfWeek: (row.collection_days_of_week as string[] | null) ?? [],
          collectionTimesPerDay: row.collection_times_per_day as number | null,
          scheduleSource: row.schedule_source as string | null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          signalCount: row.signal_count,
          activeSignalCount: row.active_signal_count,
        }))

        return Response.json({ type: 'markers', docs, zoom })
      } else {
        // Return clusters using PostGIS ST_SnapToGrid
        const gridSize = getGridSize(zoom)
        const query = sql`
          SELECT
            ST_X(ST_Centroid(ST_Collect(wc.location::geometry)))::float AS lng,
            ST_Y(ST_Centroid(ST_Collect(wc.location::geometry)))::float AS lat,
            COUNT(DISTINCT wc.id)::int AS count,
            MODE() WITHIN GROUP (ORDER BY wc.status) AS dominant_status,
            COUNT(DISTINCT s.id) FILTER (
              WHERE s.id IS NOT NULL AND s.status NOT IN ('resolved', 'rejected')
            )::int AS active_signal_count
          FROM waste_containers wc
          LEFT JOIN city_districts cd ON cd.id = wc.district_id
          LEFT JOIN waste_collection_zones wcz ON wcz.id = cd.waste_collection_zone_id
          ${scheduleJoin}
          LEFT JOIN signals s ON (
            s.city_object_reference_id = wc.public_number
            AND s.city_object_type = 'waste-container'
          )
          WHERE wc.location IS NOT NULL
            ${boundsFilter}
            ${statusFilter}
            ${wasteTypeFilter}
            ${districtFilter}
            ${zoneFilter}
            ${serviceCompanyFilter}
            ${activeSignalsFilter}
            ${createdFromFilter}
            ${createdToFilter}
            ${lastCleanedFromFilter}
            ${lastCleanedToFilter}
            ${lastCleanedNullFilter}
            ${scheduledTodayFilter}
            ${scheduleCategoryFilter}
            ${signalStatusFilter}
            ${signalContainerStateFilter}
            ${signalAgeBucketFilter}
          GROUP BY ST_SnapToGrid(wc.location::geometry, ${gridSize})
          ORDER BY count DESC
        `

        const resultRows = await db.drizzle.execute(query)
        const rows = resultRows.rows as Record<string, unknown>[]

        const docs = rows.map((row) => ({
          type: 'cluster' as const,
          lat: Number(row.lat),
          lng: Number(row.lng),
          count: Number(row.count),
          dominantStatus: String(row.dominant_status ?? 'active'),
          activeSignalCount: Number(row.active_signal_count ?? 0),
        }))

        return Response.json({ type: 'clusters', docs, zoom })
      }
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
