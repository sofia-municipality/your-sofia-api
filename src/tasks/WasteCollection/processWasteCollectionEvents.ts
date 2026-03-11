import type { TaskConfig, TaskHandler } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { type WasteCollectionEvent, groupIntoSpots } from './gpsCollectionHelpers'

export { buildSyncWindow } from './gpsCollectionHelpers'

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

  payload.logger.info(
    `[processWasteCollectionEvents] Starting sync. Window: ${input.from} → ${input.to}`
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
      `&from=${encodeURIComponent(input.from)}` +
      `&to=${encodeURIComponent(input.to)}`

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
    const shooterEvents = collectionEvents.filter(
      (p) => p.Shooter === true && [2, 5, 6, 8, 9, 12, 17, 19, 21].includes(p.Region) // update when imported more districts
    )

    // ── Step 1: cluster raw events into geographic spots (20 m radius) ────────
    // Multiple consecutive Shooter=true pings at the same location represent
    // the truck emptying several bins at one container stop.
    const spots = groupIntoSpots(shooterEvents, SPOT_CLUSTER_RADIUS_METERS)
    totalCollectionSpots += spots.length

    // ── Step 2: match each spot to the nearest container within 25 m ──────────

    for (const spot of spots) {
      const nearestQuery = sql`
        SELECT wc.id
        FROM waste_containers wc
        WHERE ST_DWithin(
          ST_MakePoint(${spot.centroidLng}, ${spot.centroidLat})::geography,
          wc.location,
          ${SEARCH_RADIUS_METERS}
        )
        ORDER BY ST_Distance(
          ST_MakePoint(${spot.centroidLng}, ${spot.centroidLat})::geography,
          wc.location
        ) ASC
        LIMIT 1
      `

      const result = await payload.db.drizzle.execute(nearestQuery)

      if (!result?.rows?.length) {
        //insert container on the missing spot and mark it prending for approval
        await payload.create({
          collection: 'waste-containers',
          data: {
            publicNumber: `NEW-${spot.latestEvent.VehicleId}-${Date.now()}`,
            location: [spot.centroidLng, spot.centroidLat],
            district: String(spot.latestEvent.Region) as any,
            status: 'pending',
            state: [],
            capacityVolume: 1.1,
            capacitySize: 'standard',
            binCount: 1,
            wasteType: 'general',
            source: `third_party`,
            lastCleaned: new Date(spot.events[0].GpsTime).toISOString(),
            notes: `Auto-created from GPS data. FirmId: ${firmId}, VehicleId: ${spot.latestEvent.VehicleId}. Please verify location and details before activating.`,
          },
        })
        missingContainers++
        continue
      }

      const containerId = String((result.rows[0] as { id: unknown }).id)
      try {
        // Fetch existing container to check if district is already set
        const existing = await payload.findByID({
          collection: 'waste-containers',
          id: containerId,
          overrideAccess: true,
        })

        await payload.update({
          collection: 'waste-containers',
          id: containerId,
          data: {
            status: 'active',
            state: [],
            lastCleaned: new Date(spot.events[0].GpsTime).toISOString(),
            servicedBy: `FirmId: ${firmId}`,
            // Only populate district if not already set
            ...(existing.district == null && { district: String(spot.latestEvent.Region) as any }),
          },
          overrideAccess: true,
          context: { skipGpsSyncHooks: true },
        })

        containersUpdated++

        // Create a ContainerObservation for audit history (no photo/user for GPS sync).
        await payload.create({
          collection: 'waste-container-observations',
          data: {
            container: Number(containerId),
            cleanedAt: new Date(spot.events[0].GpsTime).toISOString(),
            vehicleId: spot.events[0].VehicleId,
            firmId: spot.events[0].FirmId,
            collectionCount: spot.events.length,
          },
          overrideAccess: true,
        })

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
    { cron: '0 7 * * *', queue: 'default' },
    { cron: '0 19 * * *', queue: 'default' },
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
