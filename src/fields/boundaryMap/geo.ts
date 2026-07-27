/** Helpers for converting between the stored GeoJSON Polygon geometry and the
 * `[lat, lng]` rings Leaflet works with. `boundary` is stored as a GeoJSON
 * Polygon geometry object: { type: 'Polygon', coordinates: [ [ [lng, lat], ... ] ] }
 * (same shape the /api/bulky-waste-zones endpoint returns and the seed inserts). */

export type BoundaryGeometry = {
  type: 'Polygon'
  coordinates: number[][][]
}

// Leaflet order: [lat, lng]
export type LatLng = [number, number]

const EPS = 1e-9

function isNumberPair(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number'
}

/** Read the outer ring of a stored boundary into an open list of [lat, lng]
 * points (the closing duplicate point is dropped for easier editing). */
export function ringFromValue(value: unknown): LatLng[] {
  if (!value || typeof value !== 'object') return []
  const geom = value as Partial<BoundaryGeometry>
  if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return []
  const ring = geom.coordinates[0]
  if (!Array.isArray(ring)) return []

  const points: LatLng[] = []
  for (const c of ring) {
    if (isNumberPair(c)) points.push([c[1], c[0]]) // [lng, lat] -> [lat, lng]
  }

  // Drop the closing point (GeoJSON rings repeat the first coordinate at the end)
  if (points.length > 1) {
    const first = points[0]!
    const last = points[points.length - 1]!
    if (Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) {
      points.pop()
    }
  }
  return points
}

/** Build a closed GeoJSON Polygon geometry from an open [lat, lng] ring.
 * Returns null when there are fewer than 3 points (not a valid polygon yet). */
export function valueFromRing(ring: LatLng[]): BoundaryGeometry | null {
  if (ring.length < 3) return null
  const first = ring[0]!
  const coordinates = ring.map(([lat, lng]) => [lng, lat])
  coordinates.push([first[1], first[0]]) // close the ring
  return { type: 'Polygon', coordinates: [coordinates] }
}

/** Extract a Polygon geometry from arbitrary pasted GeoJSON: a bare Polygon
 * geometry, a Feature wrapping one, or a FeatureCollection (first polygon). */
export function extractPolygon(input: unknown): BoundaryGeometry | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>

  if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
    const outer = obj.coordinates[0]
    if (Array.isArray(outer) && outer.every(isNumberPair) && outer.length >= 3) {
      return { type: 'Polygon', coordinates: obj.coordinates as number[][][] }
    }
    return null
  }
  if (obj.type === 'Feature') return extractPolygon(obj.geometry)
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const feature of obj.features) {
      const geom = extractPolygon(feature)
      if (geom) return geom
    }
  }
  return null
}

/** Parse a pasted GeoJSON string into a Polygon geometry, or null if invalid. */
export function parseBoundaryInput(text: string): BoundaryGeometry | null {
  try {
    return extractPolygon(JSON.parse(text))
  } catch {
    return null
  }
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}
