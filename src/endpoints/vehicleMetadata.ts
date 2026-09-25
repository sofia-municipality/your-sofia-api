import type { Endpoint } from 'payload'
import {
  type VehicleMetadata,
  fetchVehicleMetadata,
} from '@/tasks/WasteCollection/gpsCollectionHelpers'
import { rememberContractFirms } from '@/tasks/WasteCollection/contractFirmCache'

const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_VEHICLE_IDS = 50

const cache = new Map<number, { data: VehicleMetadata; expiresAt: number }>()

/**
 * GET /api/waste-containers/vehicle-metadata?vehicleIds=114039,45617
 *
 * Proxies the GPS API's get_vehicle_metadata.php so clients never see the API key.
 * Responses are cached in memory for an hour — vehicle/firm assignments rarely change.
 */
export const vehicleMetadata: Endpoint = {
  path: '/vehicle-metadata',
  method: 'get',
  handler: async (req) => {
    const vehicleIds = [
      ...new Set(
        String(req.query?.vehicleIds ?? '')
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ]

    if (vehicleIds.length === 0) {
      return Response.json({ error: 'vehicleIds query parameter is required' }, { status: 400 })
    }
    if (vehicleIds.length > MAX_VEHICLE_IDS) {
      return Response.json(
        { error: `At most ${MAX_VEHICLE_IDS} vehicleIds per request` },
        { status: 400 }
      )
    }

    const now = Date.now()
    const result: Record<string, VehicleMetadata> = {}
    const missing: number[] = []
    for (const id of vehicleIds) {
      const cached = cache.get(id)
      if (cached && cached.expiresAt > now) {
        result[id] = cached.data
      } else {
        missing.push(id)
      }
    }

    if (missing.length > 0) {
      const fetched = await fetchVehicleMetadata(
        process.env.INSPECTORAT_GPS_API_BASE_URL,
        { 'X-API-KEY': process.env.INSPECTORAT_GPS_API_KEY ?? '' },
        missing,
        req.payload.logger
      )
      rememberContractFirms(fetched.values())
      for (const [id, data] of fetched) {
        cache.set(id, { data, expiresAt: now + CACHE_TTL_MS })
        result[id] = data
      }
    }

    return Response.json(result)
  },
}
