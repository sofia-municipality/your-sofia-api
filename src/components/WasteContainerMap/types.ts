export interface ContainerWithSignals {
  id: number
  publicNumber: string
  legacyId?: string | null
  imageId?: number | null
  location: [number, number] // [lng, lat]
  capacitySize: 'tiny' | 'small' | 'standard' | 'big' | 'industrial'
  capacityVolume: number
  wasteType:
    | 'general'
    | 'recyclables'
    | 'organic'
    | 'glass'
    | 'paper'
    | 'plastic'
    | 'metal'
    | 'trashCan'
  status: 'active' | 'full' | 'maintenance' | 'inactive' | 'pending'
  address?: string | null
  notes?: string | null
  servicedBy?: string | null
  lastCleaned?: string | null
  binCount?: number | null
  districtId?: number | null
  source?: string | null
  state?: string[]
  collectionDaysOfWeek?: string[]
  collectionTimesPerDay?: number | null
  scheduleSource?: string | null
  signalCount: number
  activeSignalCount: number
  updatedAt: string
  createdAt: string
}

export interface FilterState {
  statuses: string[]
  wasteTypes: string[]
  districtId: string | null
  volumeOptions: string[]
  zoneNumber: string | null
  hasActiveSignals: boolean
  createdFrom: string | null
  createdTo: string | null
  lastCleanedFrom: string | null
  lastCleanedTo: string | null
  lastCleanedIsNull: boolean
  scheduledToday: boolean
  scheduleCategory: string | null
  signalStatus: string | null
  signalContainerState: string | null
  signalAgeBucket: string | null
}

export const EMPTY_FILTERS: FilterState = {
  statuses: [],
  wasteTypes: [],
  districtId: null,
  volumeOptions: [],
  zoneNumber: null,
  hasActiveSignals: false,
  createdFrom: null,
  createdTo: null,
  lastCleanedFrom: null,
  lastCleanedTo: null,
  lastCleanedIsNull: false,
  scheduledToday: false,
  scheduleCategory: null,
  signalStatus: null,
  signalContainerState: null,
  signalAgeBucket: null,
}

// Query-param keys owned by the map's filter state. Anything else in the URL
// (e.g. `zoom`) is left untouched when we write filters back.
export const FILTER_QUERY_KEYS = [
  'status',
  'statuses',
  'wasteTypes',
  'volumeOptions',
  'districtId',
  'zoneNumber',
  'hasActiveSignals',
  'createdFrom',
  'createdTo',
  'lastCleanedFrom',
  'lastCleanedTo',
  'lastCleanedIsNull',
  'scheduledToday',
  'scheduleCategory',
  'signalStatus',
  'signalContainerState',
  'signalAgeBucket',
] as const

// Serialize the current filter state into query params.
export function filtersToQuery(filters: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.statuses.length > 0) p.set('statuses', filters.statuses.join(','))
  if (filters.wasteTypes.length > 0) p.set('wasteTypes', filters.wasteTypes.join(','))
  if (filters.volumeOptions.length > 0) p.set('volumeOptions', filters.volumeOptions.join(','))
  if (filters.districtId) p.set('districtId', filters.districtId)
  if (filters.zoneNumber) p.set('zoneNumber', filters.zoneNumber)
  if (filters.hasActiveSignals) p.set('hasActiveSignals', 'true')
  if (filters.createdFrom) p.set('createdFrom', filters.createdFrom)
  if (filters.createdTo) p.set('createdTo', filters.createdTo)
  if (filters.lastCleanedFrom) p.set('lastCleanedFrom', filters.lastCleanedFrom)
  if (filters.lastCleanedTo) p.set('lastCleanedTo', filters.lastCleanedTo)
  if (filters.lastCleanedIsNull) p.set('lastCleanedIsNull', 'true')
  if (filters.scheduledToday) p.set('scheduledToday', 'true')
  if (filters.scheduleCategory) p.set('scheduleCategory', filters.scheduleCategory)
  if (filters.signalStatus) p.set('signalStatus', filters.signalStatus)
  if (filters.signalContainerState) p.set('signalContainerState', filters.signalContainerState)
  if (filters.signalAgeBucket) p.set('signalAgeBucket', filters.signalAgeBucket)
  return p
}

// Parse filter state out of query params. Accepts both the map's own plural
// `statuses` key and the legacy singular `status` used by deep links from the
// metrics dashboard. Returns only the keys that are present.
export function parseFiltersFromParams(sp: URLSearchParams): Partial<FilterState> {
  const list = (key: string): string[] => {
    const v = sp.get(key)
    return v ? v.split(',').filter(Boolean) : []
  }
  const out: Partial<FilterState> = {}

  const statuses = list('statuses')
  const singleStatus = sp.get('status')
  if (statuses.length > 0) out.statuses = statuses
  else if (singleStatus) out.statuses = [singleStatus]

  const wasteTypes = list('wasteTypes')
  if (wasteTypes.length > 0) out.wasteTypes = wasteTypes
  const volumeOptions = list('volumeOptions')
  if (volumeOptions.length > 0) out.volumeOptions = volumeOptions

  const districtId = sp.get('districtId')
  if (districtId) out.districtId = districtId
  const zoneNumber = sp.get('zoneNumber')
  if (zoneNumber) out.zoneNumber = zoneNumber
  if (sp.get('hasActiveSignals') === 'true') out.hasActiveSignals = true

  const createdFrom = sp.get('createdFrom')
  if (createdFrom) out.createdFrom = createdFrom
  const createdTo = sp.get('createdTo')
  if (createdTo) out.createdTo = createdTo
  const lastCleanedFrom = sp.get('lastCleanedFrom')
  if (lastCleanedFrom) out.lastCleanedFrom = lastCleanedFrom
  const lastCleanedTo = sp.get('lastCleanedTo')
  if (lastCleanedTo) out.lastCleanedTo = lastCleanedTo
  if (sp.get('lastCleanedIsNull') === 'true') out.lastCleanedIsNull = true
  if (sp.get('scheduledToday') === 'true') out.scheduledToday = true

  const scheduleCategory = sp.get('scheduleCategory')
  if (scheduleCategory) out.scheduleCategory = scheduleCategory
  const signalStatus = sp.get('signalStatus')
  if (signalStatus) out.signalStatus = signalStatus
  const signalContainerState = sp.get('signalContainerState')
  if (signalContainerState) out.signalContainerState = signalContainerState
  const signalAgeBucket = sp.get('signalAgeBucket')
  if (signalAgeBucket) out.signalAgeBucket = signalAgeBucket

  return out
}

// ── "Uncollected" (overdue-collection) colour buckets ──────────────────────
// A container is judged against its actual collection SCHEDULE — which days of
// the week it is serviced (collectionDaysOfWeek, ISO 1=Mon..7=Sun) and how many
// times per day (collectionTimesPerDay) — not against a flat "hours since last
// cleaned" window. Lateness is measured from the NEXT scheduled pickup window
// that fell due after the container was last cleaned (its deadline to be
// serviced again), with the same 24h/36h grace used server-side in
// src/endpoints/collection-metrics.ts. Because the deadline follows the
// schedule, a Mon–Fri container is no longer flagged red over the weekend, a
// twice-daily container is judged against its earlier next window, yet a daily
// container genuinely missed for days still escalates to red.
const SOFIA_TZ = 'Europe/Sofia'
const BASE_WINDOW_HOUR = 4 // 04:00 Sofia — expected pickup time, matches collection-metrics.ts
const DELAYED_AFTER_HOURS = 24 // past the due window ⇒ delayed (orange)
const MISSED_AFTER_HOURS = 36 // past the due window ⇒ missed (red)
const MAX_FORWARD_DAYS = 8 // weekly schedule ⇒ a next window is always within a week

const sofiaPartsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: SOFIA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function getSofiaParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const parts = sofiaPartsFmt.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  let hour = get('hour')
  if (hour === 24) hour = 0 // some engines emit '24' for midnight
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute') }
}

// Convert a Sofia wall-clock instant (Y-M-D H:M local) to a UTC epoch in ms.
function sofiaWallClockToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const mapped = getSofiaParts(new Date(guess))
  const mappedUtc = Date.UTC(mapped.year, mapped.month - 1, mapped.day, mapped.hour, mapped.minute)
  return guess - (mappedUtc - guess)
}

// Pickup-window hours within a serviced day: 1×/day → [4]; 2×/day → [4, 16];
// 3×/day → [4, 12, 20]. More frequent service ⇒ an earlier next window, so a
// container is judged overdue sooner.
function windowHoursFor(timesPerDay: number): number[] {
  const n = Math.max(1, Math.floor(timesPerDay))
  const step = 24 / n
  return Array.from({ length: n }, (_, i) => BASE_WINDOW_HOUR + i * step)
}

// Epoch (ms) of the first scheduled pickup window strictly after `afterMs` —
// i.e. the deadline by which the container should next be serviced. Returns
// null only when there are no scheduled days.
function nextScheduledPickupMs(
  scheduledIsoDays: Set<number>,
  timesPerDay: number,
  afterMs: number
): number | null {
  if (scheduledIsoDays.size === 0) return null
  const hours = windowHoursFor(timesPerDay)
  const fromSofia = getSofiaParts(new Date(afterMs))
  const fromUtcMidnight = Date.UTC(fromSofia.year, fromSofia.month - 1, fromSofia.day)

  for (let ahead = 0; ahead <= MAX_FORWARD_DAYS; ahead++) {
    const dayAnchor = new Date(fromUtcMidnight + ahead * 86_400_000)
    const isoDow = dayAnchor.getUTCDay() === 0 ? 7 : dayAnchor.getUTCDay()
    if (!scheduledIsoDays.has(isoDow)) continue
    const y = dayAnchor.getUTCFullYear()
    const mo = dayAnchor.getUTCMonth() + 1
    const d = dayAnchor.getUTCDate()
    // Earliest window first: the first one after `afterMs` is the next deadline.
    for (const h of hours) {
      const whole = Math.floor(h)
      const minute = Math.round((h - whole) * 60)
      const windowMs = sofiaWallClockToMs(y, mo, d, whole, minute)
      if (windowMs > afterMs) return windowMs
    }
  }
  return null
}

function getUncollectedBucket(
  container: Pick<
    ContainerWithSignals,
    'lastCleaned' | 'collectionDaysOfWeek' | 'collectionTimesPerDay'
  >
): 'green' | 'orange' | 'red' {
  const now = Date.now()
  const cleanedMs = container.lastCleaned ? new Date(container.lastCleaned).getTime() : null
  const cleanedValid = cleanedMs !== null && Number.isFinite(cleanedMs)

  const scheduledDays = new Set(
    (container.collectionDaysOfWeek ?? []).map((v) => Number(v)).filter((n) => n >= 1 && n <= 7)
  )

  // No schedule on record (or never cleaned) → fall back to plain
  // time-since-last-cleaned so behaviour is unchanged for containers we cannot
  // evaluate against a schedule.
  const dueAt = cleanedValid
    ? nextScheduledPickupMs(
        scheduledDays,
        container.collectionTimesPerDay ?? 1,
        cleanedMs as number
      )
    : null
  if (dueAt === null) {
    if (!cleanedValid) return 'red'
    const hoursSince = (now - (cleanedMs as number)) / (1000 * 60 * 60)
    if (hoursSince <= DELAYED_AFTER_HOURS) return 'green'
    if (hoursSince <= MISSED_AFTER_HOURS) return 'orange'
    return 'red'
  }

  // Overdue measured from the next scheduled deadline after the last cleaning.
  // Negative until that deadline passes, so containers cleaned within schedule
  // stay green; the 24h grace absorbs same-day collection still in progress.
  const hoursOverdue = (now - dueAt) / (1000 * 60 * 60)
  if (hoursOverdue < DELAYED_AFTER_HOURS) return 'green'
  if (hoursOverdue < MISSED_AFTER_HOURS) return 'orange'
  return 'red'
}

export function applyFilters(containers: MarkerPoint[], filters: FilterState): MarkerPoint[] {
  const createdFromTime = filters.createdFrom ? new Date(filters.createdFrom).getTime() : null
  const createdToTime = filters.createdTo ? new Date(filters.createdTo).getTime() : null
  const selectedVolumes = filters.volumeOptions
    .map((value) => Number(value))
    .filter(Number.isFinite)
  const realStatuses = filters.statuses.filter((s) => s !== 'uncollected')

  return containers.filter((c) => {
    const createdAtTime = new Date(c.createdAt).getTime()

    if (realStatuses.length > 0 && !realStatuses.includes(c.status)) return false
    if (filters.wasteTypes.length > 0 && !filters.wasteTypes.includes(c.wasteType)) return false
    if (filters.districtId !== null && c.districtId !== Number(filters.districtId)) return false
    if (filters.hasActiveSignals && c.activeSignalCount === 0) return false
    if (createdFromTime !== null && createdAtTime < createdFromTime) return false
    if (createdToTime !== null && createdAtTime >= createdToTime) return false
    if (selectedVolumes.length > 0 && !selectedVolumes.includes(c.capacityVolume)) return false
    return true
  })
}

export function getMarkerColor(c: ContainerWithSignals, uncollectedMode?: boolean): string {
  if (uncollectedMode) {
    const bucket = getUncollectedBucket(c)
    if (bucket === 'red') return '#EF4444'
    if (bucket === 'orange') return '#F97316'
    return '#22C55E'
  }
  if (c.status === 'inactive' || c.status === 'pending') return '#9CA3AF'
  if (c.status === 'full' || c.status === 'maintenance') return '#EF4444'
  if (c.activeSignalCount > 0) return '#F97316'
  return '#22C55E'
}

export interface Bounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface MarkerPoint extends ContainerWithSignals {
  type: 'marker'
}

export interface ClusterPoint {
  type: 'cluster'
  lat: number
  lng: number
  count: number
  dominantStatus: string
  activeSignalCount: number
}

export type MapItem = ClusterPoint | MarkerPoint
