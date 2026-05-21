import type { TaskConfig, TaskHandler } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import {
  type WasteCollectionEvent,
  buildSyncWindow,
  groupIntoSpots,
  parseGpsTime,
} from './gpsCollectionHelpers'

export { buildSyncWindow } from './gpsCollectionHelpers'
import { resolveOpenContainerSignals } from './resolveOpenContainerSignals'

// ─────────────────────────────────────────────────────────────────────────────
// Task handler
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_RADIUS_METERS = 50
const SPOT_CLUSTER_RADIUS_METERS = 20

const handler: TaskHandler<'processWasteCollectionEvents'> = async ({ input, req }) => {
  const { payload } = req

  const baseUrl = process.env.INSPECTORAT_GPS_API_BASE_URL
  const apiKey = process.env.INSPECTORAT_GPS_API_KEY ?? ''
  const gpsHeaders = { 'X-API-KEY': apiKey }

  const { from, to } = input?.from && input?.to ? input : buildSyncWindow(1)

  payload.logger.info(`[processWasteCollectionEvents] Starting sync. Window: ${from} → ${to}`)

  // ── Build Region → city-district Payload ID lookup ─────────────────────────
  // CityDistrict.districtId matches the GPS API Region field (1–24).
  const allDistricts = await payload.find({
    collection: 'city-districts',
    limit: 30,
    overrideAccess: true,
  })
  const districtIdByRegion = new Map<number, number>(
    allDistricts.docs.map((d) => [d.districtId as number, d.id as number])
  )
  const districtCodeByRegion = new Map<number, string>(
    allDistricts.docs.map((d) => [d.districtId as number, (d as any).code as string])
  )

  // ── T1: Retrieve active fleet firm IDs ─────────────────────────────────────
  const fidResponse = await fetch(`${baseUrl}/get_fid.php`, { headers: gpsHeaders })
  if (!fidResponse.ok) {
    throw new Error(`GPS T1 failed: ${fidResponse.status} ${fidResponse.statusText}`)
  }
  const firmIds: number[] = await fidResponse.json()
  //firmIds = firmIds.filter((id) => id === 56)

  payload.logger.info(`[processWasteCollectionEvents] Active firm IDs: [${firmIds.join(', ')}]`)

  let totalCollectionSpots = 0
  let totalContainersUpdated = 0
  let totalMissingContainers = 0
  let totalObservationsCreated = 0

  // ── T2: For each firm, fetch collection events for the time window ─────────────────
  for (const firmId of firmIds) {
    let containersUpdated = 0
    let missingContainers = 0
    let observationsCreated = 0

    const vehicleUrl =
      `${baseUrl}/get_vehicle.php` +
      `?f=${firmId}` +
      `&from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}`

    const vehicleResponse = await fetch(vehicleUrl, { headers: gpsHeaders })
    if (!vehicleResponse.ok) {
      payload.logger.warn(
        `[processWasteCollectionEvents] GPS T2 failed for firmId=${firmId}: ` +
          `${vehicleResponse.status} ${vehicleResponse.statusText}`
      )
      continue
    }

    const collectionEvents: WasteCollectionEvent[] = await vehicleResponse.json()

    // Keep only data points where the collection arm (Shooter) was active
    const shooterEvents = collectionEvents.filter((p) => p.Shooter === true)

    // ── Step 1: cluster raw events into geographic spots (20 m radius) ────────
    // Multiple consecutive Shooter=true pings at the same location represent
    // the truck emptying several bins at one container stop.
    const spots = groupIntoSpots(shooterEvents, SPOT_CLUSTER_RADIUS_METERS)
    totalCollectionSpots += spots.length

    // ── Step 2: match each spot to the nearest container within 50 m ──────────

    for (const spot of spots) {
      const nearestQuery = sql`
        SELECT
          wc.id,
          wc.district_id,
          wc.public_number,
          wc.status,
          COALESCE(json_agg(wcs.value) FILTER (WHERE wcs.value IS NOT NULL), '[]'::json) AS state
        FROM waste_containers wc
        LEFT JOIN waste_containers_state wcs ON wcs.parent_id = wc.id
        WHERE ST_DWithin(
          ST_MakePoint(${spot.centroidLng}, ${spot.centroidLat})::geography,
          wc.location,
          ${SEARCH_RADIUS_METERS}
        )
        GROUP BY wc.id
        ORDER BY ST_Distance(
          ST_MakePoint(${spot.centroidLng}, ${spot.centroidLat})::geography,
          wc.location
        ) ASC
        LIMIT 1
      `

      const result = await payload.db.drizzle.execute(nearestQuery)
      const nearestContainer = result?.rows?.[0]
      let containerId = nearestContainer?.id as number | undefined
      const districtExists = nearestContainer?.district_id
      const containerPublicNumber = nearestContainer?.public_number as string | undefined
      const containerState = Array.isArray(nearestContainer?.state) ? nearestContainer.state : []
      const keepBulkyWasteState = containerState.includes('bulkyWaste')
      if (!containerId) {
        //insert container on the missing spot and mark it prending for approval
        const newContainer = await payload.create({
          collection: 'waste-containers',
          data: {
            publicNumber: `${districtCodeByRegion.get(spot.latestEvent.Region) ?? 'NEW'}-${Date.now()}`,
            location: [spot.centroidLng, spot.centroidLat],
            district: districtIdByRegion.get(spot.latestEvent.Region) ?? null,
            status: 'pending',
            state: [],
            capacityVolume: 1.1,
            capacitySize: 'standard',
            binCount: 1,
            wasteType: 'general',
            source: `third_party`,
            lastCleaned: parseGpsTime(spot.events[0].GpsTime).toISOString(),
            notes: `Auto-created from GPS data. FirmId: ${firmId}, VehicleId: ${spot.latestEvent.VehicleId}. Please verify location and details before activating.`,
          },
        })
        missingContainers++
        containerId = newContainer.id
      } else {
        //container exists, but we can update its lastCleaned and servicedBy fields based on the GPS event
        try {
          await payload.update({
            collection: 'waste-containers',
            id: containerId,
            data: {
              status: nearestContainer?.status === 'full' ? 'active' : undefined, // make active only if it was full before
              state: keepBulkyWasteState ? ['bulkyWaste'] : [],
              lastCleaned: parseGpsTime(spot.events[0].GpsTime).toISOString(),
              servicedBy: `Фирма: ${firmId}`,
              district: !districtExists
                ? (districtIdByRegion.get(spot.latestEvent.Region) ?? undefined)
                : undefined, //update district only if it was missing before
            },
            overrideAccess: true,
          })

          containersUpdated++
        } catch (err) {
          payload.logger.error(
            `[processWasteCollectionEvents] Failed to update container ${containerId}: ${String(err)}`
          )
        }

        // Resolve any open signal for this container — GPS confirmed it was collected
        if (containerPublicNumber) {
          await resolveOpenContainerSignals(payload, containerPublicNumber)
        }
      }

      try {
        // Upsert a ContainerObservation for audit history (no photo/user for GPS sync).
        await payload.db.drizzle.execute(sql`
          INSERT INTO waste_container_observations
            (container_id, cleaned_at, vehicle_id, firm_id, collection_count, updated_at, created_at)
          VALUES
            (${Number(containerId)}, ${parseGpsTime(spot.events[0].GpsTime).toISOString()},
             ${spot.events[0].VehicleId}, ${spot.events[0].FirmId}, ${spot.events.length}, NOW(), NOW())
          ON CONFLICT (container_id, cleaned_at)
          DO NOTHING
        `)

        observationsCreated++
      } catch (err) {
        payload.logger.error(
          `[processWasteCollectionEvents] Failed to process container ${containerId}: ${String(err)}`
        )
      }
    }
    payload.logger.info(
      `[processWasteCollectionEvents] firmId=${firmId}: ` +
        `${collectionEvents.length} total GPS points, ` +
        `${shooterEvents.length} shooter events → ${spots.length} collection spots: ` +
        `containersUpdated=${containersUpdated} observations=${observationsCreated} missingContainers=${missingContainers}`
    )

    totalContainersUpdated += containersUpdated
    totalMissingContainers += missingContainers
    totalObservationsCreated += observationsCreated
  }

  payload.logger.info(
    `[processWasteCollectionEvents] Done. ` +
      `firms=${firmIds.length} points=${totalCollectionSpots} ` +
      `containersUpdated=${totalContainersUpdated} observations=${totalObservationsCreated} missingContainers=${totalMissingContainers}`
  )

  return {
    output: {
      firmsProcessed: firmIds.length,
      pointsTotal: totalCollectionSpots,
      containersUpdated: totalContainersUpdated,
      observationsCreated: totalObservationsCreated,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported task config — registered in payload.config.ts  jobs.tasks[]
// ─────────────────────────────────────────────────────────────────────────────

export const processWasteCollectionEvents: TaskConfig<'processWasteCollectionEvents'> = {
  slug: 'processWasteCollectionEvents',
  label: 'Process Waste Collection Events',
  schedule: [
    { cron: '02 * * * *', queue: 'default' }, // Run at 2 minutes past every hour
  ],
  inputSchema: [
    { name: 'from', type: 'text', required: true },
    { name: 'to', type: 'text', required: true },
  ],
  outputSchema: [
    { name: 'firmsProcessed', type: 'number', required: true },
    { name: 'pointsTotal', type: 'number', required: true },
    { name: 'containersUpdated', type: 'number', required: true },
    { name: 'observationsCreated', type: 'number', required: true },
  ],
  retries: 2,
  handler,
}
