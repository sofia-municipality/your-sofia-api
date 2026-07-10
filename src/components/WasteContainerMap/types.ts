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

function getUncollectedBucket(lastCleaned?: string | null): 'green' | 'orange' | 'red' {
  if (!lastCleaned) return 'red'

  // Keep parity with mobile logic: PostgreSQL timestamp with space separator.
  const hoursSince = (Date.now() - new Date(lastCleaned).getTime()) / (1000 * 60 * 60)

  if (!Number.isFinite(hoursSince)) return 'red'
  if (hoursSince <= 24) return 'green'
  if (hoursSince <= 36) return 'orange'
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
    const bucket = getUncollectedBucket(c.lastCleaned)
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
