/**
 * Maps a raw MongoDB document from the OboApp `messages` collection to the
 * public UpdateMessage shape consumed by the YSM mobile app.
 *
 * Excluded fields (never sent to clients):
 *   embedding, process, ingestErrors, sourceDocumentId,
 *   isRelevant, isUnreadable, eventId, notificationsSent
 *
 * Dates stored as native MongoDB Date objects are converted to ISO-8601 strings.
 * Fields stored as stringified JSON (geoJson in some older records) are parsed.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number
  lng: number
}

export interface UpdateAddress {
  originalText?: string
  formattedAddress?: string
  coordinates?: Coordinates
}

export interface GeoJsonGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | string
  coordinates: unknown
}

export interface GeoJsonFeature {
  type: 'Feature'
  geometry: GeoJsonGeometry
  properties?: Record<string, unknown>
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export interface UpdateTimespan {
  start: string | null
  end: string | null
}

export interface UpdatePin {
  address: string
  coordinates?: Coordinates
  timespans: UpdateTimespan[]
}

export interface UpdateStreet {
  street: string
  from: string
  fromCoordinates?: Coordinates
  to: string
  toCoordinates?: Coordinates
  timespans: UpdateTimespan[]
}

export interface UpdateCadastralProperty {
  identifier: string
  timespans: UpdateTimespan[]
}

export interface UpdateMessage {
  id?: string
  text: string
  plainText?: string
  markdownText?: string
  addresses?: UpdateAddress[]
  geoJson?: GeoJsonFeatureCollection
  createdAt: string
  crawledAt?: string
  finalizedAt?: string
  source?: string
  sourceUrl?: string
  categories?: string[]
  timespanStart?: string
  timespanEnd?: string
  cityWide?: boolean
  responsibleEntity?: string
  pins?: UpdatePin[]
  streets?: UpdateStreet[]
  cadastralProperties?: UpdateCadastralProperty[]
  busStops?: string[]
  locality?: string
}

// ─── Date helpers ─────────────────────────────────────────────────────────

function toISOString(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 0) return value
  // Firestore Timestamp shape (toDate method)
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate()
    return d instanceof Date ? d.toISOString() : undefined
  }
  return undefined
}

function toRequiredISOString(value: unknown, fallback: string): string {
  return toISOString(value) ?? fallback
}

function resolveTimespan(
  record: Record<string, unknown>,
  createdAtIso: string
): { timespanStart: string; timespanEnd: string } {
  const start = toISOString(record.timespanStart)
  const end = toISOString(record.timespanEnd)
  const fallback = toISOString(record.finalizedAt) ?? toISOString(record.crawledAt) ?? createdAtIso
  return {
    timespanStart: start ?? end ?? fallback,
    timespanEnd: end ?? start ?? fallback,
  }
}

// ─── Field helpers ────────────────────────────────────────────────────────

function optStr(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toCoordinates(value: unknown): Coordinates | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const c = value as Record<string, unknown>
  const lat = typeof c.lat === 'number' ? c.lat : undefined
  const lng = typeof c.lng === 'number' ? c.lng : undefined
  if (lat === undefined || lng === undefined) return undefined
  return { lat, lng }
}

function getAddresses(value: unknown): UpdateAddress[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): UpdateAddress | null => {
      if (typeof item !== 'object' || item === null) return null
      const a = item as Record<string, unknown>
      return {
        originalText: optStr(a.originalText),
        formattedAddress: optStr(a.formattedAddress),
        coordinates: toCoordinates(a.coordinates),
      }
    })
    .filter((x): x is UpdateAddress => x !== null)
}

function parseGeoJsonIfNeeded(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }
  return value
}

function getFeatureCollection(value: unknown): GeoJsonFeatureCollection | undefined {
  const parsed = parseGeoJsonIfNeeded(value)
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const fc = parsed as Record<string, unknown>
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return undefined
  const features: GeoJsonFeature[] = fc.features
    .map((f: unknown): GeoJsonFeature | null => {
      if (typeof f !== 'object' || f === null) return null
      const feat = f as Record<string, unknown>
      if (!feat.geometry || typeof feat.geometry !== 'object') return null
      return {
        type: 'Feature',
        geometry: feat.geometry as GeoJsonGeometry,
        properties:
          typeof feat.properties === 'object' && feat.properties !== null
            ? (feat.properties as Record<string, unknown>)
            : undefined,
      }
    })
    .filter((x): x is GeoJsonFeature => x !== null)
  return { type: 'FeatureCollection', features }
}

function getCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function getTimespans(value: unknown): UpdateTimespan[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): UpdateTimespan | null => {
      if (typeof item !== 'object' || item === null) return null
      const t = item as Record<string, unknown>
      const start = toISOString(t.start) ?? null
      const end = toISOString(t.end) ?? null
      return { start, end }
    })
    .filter((x): x is UpdateTimespan => x !== null)
}

function getPins(value: unknown): UpdatePin[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): UpdatePin | null => {
      if (typeof item !== 'object' || item === null) return null
      const p = item as Record<string, unknown>
      const address = optStr(p.address)
      if (!address) return null
      return {
        address,
        coordinates: toCoordinates(p.coordinates),
        timespans: getTimespans(p.timespans),
      }
    })
    .filter((x): x is UpdatePin => x !== null)
}

function getStreets(value: unknown): UpdateStreet[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): UpdateStreet | null => {
      if (typeof item !== 'object' || item === null) return null
      const s = item as Record<string, unknown>
      const street = optStr(s.street)
      const from = optStr(s.from)
      const to = optStr(s.to)
      if (!street || !from || !to) return null
      return {
        street,
        from,
        fromCoordinates: toCoordinates(s.fromCoordinates),
        to,
        toCoordinates: toCoordinates(s.toCoordinates),
        timespans: getTimespans(s.timespans),
      }
    })
    .filter((x): x is UpdateStreet => x !== null)
}

function getCadastralProperties(value: unknown): UpdateCadastralProperty[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): UpdateCadastralProperty | null => {
      if (typeof item !== 'object' || item === null) return null
      const c = item as Record<string, unknown>
      const identifier = optStr(c.identifier)
      if (!identifier) return null
      return { identifier, timespans: getTimespans(c.timespans) }
    })
    .filter((x): x is UpdateCadastralProperty => x !== null)
}

function getBusStops(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

// ─── Public mapper ────────────────────────────────────────────────────────

/**
 * Convert a raw MongoDB document from the `messages` collection to a public
 * UpdateMessage.  Returns `null` only when an unrecoverable error occurs;
 * optional fields such as `createdAt` fall back to safe defaults (e.g. current
 * time) rather than causing a null return.
 */
export function docToUpdateMessage(doc: Record<string, unknown>): UpdateMessage | null {
  try {
    const createdAt = toRequiredISOString(doc.createdAt, new Date().toISOString())
    const { timespanStart, timespanEnd } = resolveTimespan(doc, createdAt)

    const id =
      typeof doc._id === 'string'
        ? doc._id
        : doc._id && typeof (doc._id as Record<string, unknown>).toString === 'function'
          ? String(doc._id)
          : undefined

    return {
      id,
      text: typeof doc.text === 'string' ? doc.text : '',
      locality: typeof doc.locality === 'string' ? doc.locality : undefined,
      plainText: optStr(doc.plainText),
      markdownText: optStr(doc.markdownText),
      addresses: getAddresses(doc.addresses),
      geoJson: getFeatureCollection(doc.geoJson),
      createdAt,
      crawledAt: toISOString(doc.crawledAt),
      finalizedAt: toISOString(doc.finalizedAt),
      source: optStr(doc.source),
      sourceUrl: optStr(doc.sourceUrl),
      categories: getCategories(doc.categories),
      timespanStart,
      timespanEnd,
      cityWide: doc.cityWide === true,
      responsibleEntity: optStr(doc.responsibleEntity),
      pins: getPins(doc.pins),
      streets: getStreets(doc.streets),
      cadastralProperties: getCadastralProperties(doc.cadastralProperties),
      busStops: getBusStops(doc.busStops),
    }
  } catch {
    return null
  }
}

/**
 * Returns true if any pin has a null/missing timespans.start.
 * Messages with such pins are dropped from public responses because they
 * would display incorrectly on the mobile timeline.
 */
export function hasNullPinTimespanStart(msg: UpdateMessage): boolean {
  return (msg.pins ?? []).some((pin) =>
    (pin.timespans ?? []).some((ts) => ts.start === null || ts.start === undefined)
  )
}

// ─── Viewport helpers ─────────────────────────────────────────────────────

export interface ViewportBounds {
  north: number
  south: number
  east: number
  west: number
}

function pointInBounds(lat: number, lng: number, bounds: ViewportBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east
}

function geometryCentroid(geometry: GeoJsonGeometry): Coordinates | null {
  if (
    geometry.type === 'Point' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  ) {
    const [lng, lat] = geometry.coordinates as [number, number, ...number[]]
    return { lat, lng }
  }

  if (
    (geometry.type === 'LineString' || geometry.type === 'Polygon') &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0
  ) {
    const ring: [number, number][] =
      geometry.type === 'Polygon'
        ? ((geometry.coordinates as [number, number][][])[0] ?? [])
        : (geometry.coordinates as [number, number][])
    if (!ring.length) return null
    const lats = ring.map((c) => c[1])
    const lngs = ring.map((c) => c[0])
    return {
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    }
  }
  return null
}

/**
 * Returns true when a message should appear within the given viewport.
 * cityWide messages are always included when a bounds filter is active.
 * Messages with no locatable geometry (no geoJson features with coords, no
 * pins with coordinates) are also always included — they are informational
 * city-wide messages that cannot be spatially filtered.
 */
export function messageInBounds(msg: UpdateMessage, bounds: ViewportBounds): boolean {
  if (msg.cityWide) return true

  const geoFeatures = msg.geoJson?.features ?? []
  const pinsWithCoords = (msg.pins ?? []).filter((p) => p.coordinates)

  // No locatable geometry — treat as city-wide informational message
  if (geoFeatures.length === 0 && pinsWithCoords.length === 0) return true

  for (const feature of geoFeatures) {
    if (!feature.geometry) continue
    const centroid = geometryCentroid(feature.geometry)
    if (centroid && pointInBounds(centroid.lat, centroid.lng, bounds)) return true
  }

  for (const pin of pinsWithCoords) {
    if (pointInBounds(pin.coordinates!.lat, pin.coordinates!.lng, bounds)) return true
  }

  return false
}

// ─── Sort helper ──────────────────────────────────────────────────────────

export function sortByRelevance(messages: UpdateMessage[]): UpdateMessage[] {
  return [...messages].sort((a, b) => {
    const aF = a.finalizedAt ?? ''
    const bF = b.finalizedAt ?? ''
    if (aF !== bF) return bF.localeCompare(aF)
    const aE = a.timespanEnd ?? ''
    const bE = b.timespanEnd ?? ''
    return bE.localeCompare(aE)
  })
}
