// ─────────────────────────────────────────────────────────────────────────────
// External GPS API types  (gps.inspectorat-so.org)
// ─────────────────────────────────────────────────────────────────────────────

export interface WasteCollectionEvent {
  Id: number
  GpsTime: string
  ReceiveTime: string
  Region: number
  VehicleId: number
  Longitude: number
  Latitude: number
  Altitude: number | null
  Angle: number
  Satelites: number
  Speed: number
  SpecificationType: number
  Contact: boolean
  Plow: boolean | null
  Spreader: boolean | null
  /** true when the truck's collection arm was active = container being emptied */
  Shooter: boolean | null
  Pump: boolean | null
  Brushes: boolean | null
  FirmId: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Spatial helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Approximate distance in metres between two WGS-84 points (Haversine). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface CollectionSpot {
  /** Running centroid longitude of all grouped events. */
  centroidLng: number
  /** Running centroid latitude of all grouped events. */
  centroidLat: number
  /** All GPS events belonging to this spot (always at least one). */
  events: [WasteCollectionEvent, ...WasteCollectionEvent[]]
  /** The event with the latest GpsTime — used as the authoritative timestamp. */
  latestEvent: WasteCollectionEvent
}

/**
 * Greedy spatial clustering: groups GPS events that fall within `radiusMeters`
 * of each other into a single CollectionSpot. Events are first partitioned by
 * `VehicleId`, then spatially clustered within each vehicle's events. The
 * centroid is updated incrementally as events are added, so later events can
 * join an existing spot even if they are slightly further from its seed point.
 */
export function groupIntoSpots(
  events: WasteCollectionEvent[],
  radiusMeters: number
): CollectionSpot[] {
  const byVehicle = new Map<number, WasteCollectionEvent[]>()
  for (const event of events) {
    const bucket = byVehicle.get(event.VehicleId)
    if (bucket) {
      bucket.push(event)
    } else {
      byVehicle.set(event.VehicleId, [event])
    }
  }

  const spots: CollectionSpot[] = []

  for (const vehicleEvents of byVehicle.values()) {
    for (const collectionEvent of vehicleEvents) {
      let nearest: CollectionSpot | null = null
      let nearestDist = Infinity

      for (const spot of spots) {
        const dist = haversineMeters(
          collectionEvent.Latitude,
          collectionEvent.Longitude,
          spot.centroidLat,
          spot.centroidLng
        )
        if (dist <= radiusMeters && dist < nearestDist) {
          nearest = spot
          nearestDist = dist
        }
      }

      if (nearest) {
        nearest.events.push(collectionEvent)
        // Update running centroid
        nearest.centroidLng =
          nearest.events.reduce((s, e) => s + e.Longitude, 0) / nearest.events.length
        nearest.centroidLat =
          nearest.events.reduce((s, e) => s + e.Latitude, 0) / nearest.events.length
        if (parseGpsTime(collectionEvent.GpsTime) > parseGpsTime(nearest.latestEvent.GpsTime)) {
          nearest.latestEvent = collectionEvent
        }
      } else {
        spots.push({
          centroidLng: collectionEvent.Longitude,
          centroidLat: collectionEvent.Latitude,
          events: [collectionEvent],
          latestEvent: collectionEvent,
        })
      }
    }
  }

  return spots
}

// ─────────────────────────────────────────────────────────────────────────────
// Date/time helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a GpsTime string from the API as UTC.
 * The API returns times without a timezone suffix (e.g. "2026-03-13 17:53:17"),
 * so we normalise the string to ISO 8601 UTC before parsing.
 */
export function parseGpsTime(gpsTime: string): Date {
  // If already has offset/Z, parse as-is; otherwise treat as UTC.
  const normalised = /[Z+\-]\d*$/.test(gpsTime.trim())
    ? gpsTime
    : gpsTime.trim().replace(' ', 'T') + 'Z'
  return new Date(normalised)
}

/** Format a Date as the GPS API expects: "YYYY-MM-DD HH:MM" (local time) */
export function formatApiDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Compute from/to strings for the given interval sync window ending at `now`. */
export function buildSyncWindow(
  hoursInterval: number = 1,
  now: Date = new Date()
): { from: string; to: string } {
  const to = new Date(now)
  const from = new Date(now.getTime() - hoursInterval * 60 * 60 * 1000)
  return { from: formatApiDate(from), to: formatApiDate(to) }
}
