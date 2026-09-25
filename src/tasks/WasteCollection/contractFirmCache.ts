import {
  type VehicleMetadata,
  type WasteCollectionEvent,
  buildSyncWindow,
  fetchVehicleMetadata,
} from './gpsCollectionHelpers'

// ─────────────────────────────────────────────────────────────────────────────
// Contract → firm lookup
//
// `servicedBy` on a container holds the GPS contract ID (the `f` param of
// get_vehicle.php / the values from get_fid.php). The GPS API has no endpoint that
// maps a contract to its firm, so the mapping is learnt from vehicle metadata and
// cached in memory.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractFirm = Pick<VehicleMetadata, 'firm' | 'contract'>

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MISS_TTL_MS = 10 * 60 * 1000
/** Progressively wider windows (minutes) to find at least one vehicle on the contract. */
const LOOKUP_WINDOWS_MINUTES = [30, 3 * 60, 24 * 60]

const cache = new Map<number, { data: ContractFirm | null; expiresAt: number }>()

type Logger = { warn: (msg: string) => void }

function gpsConfig() {
  return {
    baseUrl: process.env.INSPECTORAT_GPS_API_BASE_URL,
    headers: { 'X-API-KEY': process.env.INSPECTORAT_GPS_API_KEY ?? '' },
  }
}

/** Record contract → firm pairs from any vehicle metadata we have fetched. */
export function rememberContractFirms(metadata: Iterable<VehicleMetadata>): void {
  const expiresAt = Date.now() + CACHE_TTL_MS
  for (const { firm, contract } of metadata) {
    if (contract?.id != null && firm) {
      cache.set(Number(contract.id), { data: { firm, contract }, expiresAt })
    }
  }
}

/** Metadata for one vehicle; also feeds the contract cache. */
export async function getVehicleMetadata(
  vehicleId: number,
  logger: Logger
): Promise<VehicleMetadata | null> {
  const { baseUrl, headers } = gpsConfig()
  const metadata = await fetchVehicleMetadata(baseUrl, headers, [vehicleId], logger)
  rememberContractFirms(metadata.values())
  return metadata.get(vehicleId) ?? null
}

/** Firm for a GPS contract ID, resolved through any vehicle currently on that contract. */
export async function getContractFirm(
  contractId: number,
  logger: Logger
): Promise<ContractFirm | null> {
  const cached = cache.get(contractId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const { baseUrl, headers } = gpsConfig()
  for (const minutes of LOOKUP_WINDOWS_MINUTES) {
    const { from, to } = buildSyncWindow(minutes)
    try {
      const res = await fetch(
        `${baseUrl}/get_vehicle.php?f=${contractId}` +
          `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers }
      )
      if (!res.ok) {
        logger.warn(`[getContractFirm] get_vehicle failed for f=${contractId}: ${res.status}`)
        break
      }
      const events = ((await res.json()) ?? []) as WasteCollectionEvent[]
      const vehicleId = events.find((e) => Number.isFinite(e.VehicleId))?.VehicleId
      if (vehicleId == null) continue

      const metadata = await getVehicleMetadata(vehicleId, logger)
      if (metadata) {
        // The vehicle's current contract may differ; only trust it if it matches
        const hit = cache.get(contractId)
        if (hit?.data) return hit.data
      }
    } catch (err) {
      logger.warn(`[getContractFirm] Request error for f=${contractId}: ${String(err)}`)
      break
    }
  }

  cache.set(contractId, { data: null, expiresAt: Date.now() + MISS_TTL_MS })
  return null
}
