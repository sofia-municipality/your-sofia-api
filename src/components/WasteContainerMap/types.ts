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
