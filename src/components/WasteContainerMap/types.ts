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

export function applyFilters(containers: MarkerPoint[], filters: FilterState): MarkerPoint[] {
  const createdFromTime = filters.createdFrom ? new Date(filters.createdFrom).getTime() : null
  const createdToTime = filters.createdTo ? new Date(filters.createdTo).getTime() : null

  return containers.filter((c) => {
    const createdAtTime = new Date(c.createdAt).getTime()

    if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false
    if (filters.wasteTypes.length > 0 && !filters.wasteTypes.includes(c.wasteType)) return false
    if (filters.districtId !== null && c.districtId !== Number(filters.districtId)) return false
    if (filters.hasActiveSignals && c.activeSignalCount === 0) return false
    if (createdFromTime !== null && createdAtTime < createdFromTime) return false
    if (createdToTime !== null && createdAtTime >= createdToTime) return false
    return true
  })
}

export function getMarkerColor(c: ContainerWithSignals): string {
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
