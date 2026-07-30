import {
  FOUNTAIN_ACTIVATION_OPTIONS,
  FOUNTAIN_STATUS_OPTIONS,
} from '@/collections/DrinkingFountains'

export interface Fountain {
  id: number
  publicNumber: string | null
  address: string
  location: [number, number] // [lng, lat]
  isActive: boolean | null // true = works, false = doesn't work, null = no information
  protectionStatus: string | null
  externalLink: string | null
  district: number | null
  districtNumber: number | null
  districtName: string | null
  source: number | null
  sourceName: string | null
  status: string | null
  owner: number | null
  ownerName: string | null
  activationType: string | null
  signalCount: number
  activeSignalCount: number
  createdAt: string
  updatedAt: string
}

export type ActiveState = 'active' | 'inactive' | 'unknown'

export interface FilterState {
  activeStates: ActiveState[]
  districtNumber: string | null
  sourceIds: string[]
  statusIds: string[]
  activationTypeIds: string[]
  ownerIds: string[]
  hasActiveSignals: boolean
  search: string
}

export const EMPTY_FILTERS: FilterState = {
  activeStates: [],
  districtNumber: null,
  sourceIds: [],
  statusIds: [],
  activationTypeIds: [],
  ownerIds: [],
  hasActiveSignals: false,
  search: '',
}

const ACTIVE_STATE_VALUES: ActiveState[] = ['active', 'inactive', 'unknown']

// Query-param keys owned by the fountain map's filter state. Anything else in the
// URL is left untouched when we write filters back.
export const FILTER_QUERY_KEYS = [
  'active',
  'sources',
  'statuses',
  'activations',
  'owners',
  'district',
  'signals',
  'q',
] as const

// Serialize the current filter state into query params.
export function filtersToQuery(filters: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.activeStates.length > 0) p.set('active', filters.activeStates.join(','))
  if (filters.sourceIds.length > 0) p.set('sources', filters.sourceIds.join(','))
  if (filters.statusIds.length > 0) p.set('statuses', filters.statusIds.join(','))
  if (filters.activationTypeIds.length > 0)
    p.set('activations', filters.activationTypeIds.join(','))
  if (filters.ownerIds.length > 0) p.set('owners', filters.ownerIds.join(','))
  if (filters.districtNumber) p.set('district', filters.districtNumber)
  if (filters.hasActiveSignals) p.set('signals', 'true')
  if (filters.search.trim()) p.set('q', filters.search.trim())
  return p
}

// Parse filter state out of query params. Returns only the keys that are present.
export function parseFiltersFromParams(sp: URLSearchParams): Partial<FilterState> {
  const list = (key: string): string[] => {
    const v = sp.get(key)
    return v ? v.split(',').filter(Boolean) : []
  }
  const out: Partial<FilterState> = {}

  const active = list('active').filter((v): v is ActiveState =>
    (ACTIVE_STATE_VALUES as string[]).includes(v)
  )
  if (active.length > 0) out.activeStates = active
  const sources = list('sources')
  if (sources.length > 0) out.sourceIds = sources
  const statuses = list('statuses')
  if (statuses.length > 0) out.statusIds = statuses
  const activations = list('activations')
  if (activations.length > 0) out.activationTypeIds = activations
  const owners = list('owners')
  if (owners.length > 0) out.ownerIds = owners
  const district = sp.get('district')
  if (district) out.districtNumber = district
  if (sp.get('signals') === 'true') out.hasActiveSignals = true
  const q = sp.get('q')
  if (q) out.search = q

  return out
}

export interface Bounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export const ACTIVE_STATE_LABELS: Record<ActiveState, string> = {
  active: 'Действащи',
  inactive: 'Недействащи',
  unknown: 'Няма данни',
}

export const ACTIVE_STATE_COLORS: Record<ActiveState, string> = {
  active: '#22C55E',
  inactive: '#EF4444',
  unknown: '#9CA3AF',
}

/** A lookup option derived from the loaded dataset (id → name). */
export interface LookupOption {
  id: number
  name: string
}

/** A value/label pair for the string-valued `select` filters. */
export interface SelectOption {
  value: string
  label: string
}

/** Relationship lookup lists (fetched from the REST API) used when editing a fountain. */
export interface Lookups {
  sources: LookupOption[]
  owners: LookupOption[]
}

interface FilterOptions {
  districts: { number: number; name: string }[]
  sources: LookupOption[]
  statuses: SelectOption[]
  activationTypes: SelectOption[]
  owners: LookupOption[]
}

/** Derive the distinct filter options actually present in the loaded data. */
export function buildFilterOptions(fountains: Fountain[]): FilterOptions {
  const districts = new Map<number, string>()
  const sources = new Map<number, string>()
  const statuses = new Set<string>()
  const activationTypes = new Set<string>()
  const owners = new Map<number, string>()

  for (const f of fountains) {
    if (f.districtNumber != null) {
      districts.set(f.districtNumber, f.districtName ?? `Район ${f.districtNumber}`)
    }
    if (f.source != null && f.sourceName) sources.set(f.source, f.sourceName)
    if (f.status) statuses.add(f.status)
    if (f.activationType) activationTypes.add(f.activationType)
    if (f.owner != null && f.ownerName) owners.set(f.owner, f.ownerName)
  }

  const byName = (a: LookupOption, b: LookupOption) => a.name.localeCompare(b.name, 'bg')
  const toSelectOptions = (present: Set<string>, canonical: readonly string[]): SelectOption[] =>
    canonical.filter((v) => present.has(v)).map((v) => ({ value: v, label: v }))

  return {
    districts: [...districts.entries()]
      .map(([number, name]) => ({ number, name }))
      .sort((a, b) => a.number - b.number),
    sources: [...sources.entries()].map(([id, name]) => ({ id, name })).sort(byName),
    statuses: toSelectOptions(statuses, FOUNTAIN_STATUS_OPTIONS),
    activationTypes: toSelectOptions(activationTypes, FOUNTAIN_ACTIVATION_OPTIONS),
    owners: [...owners.entries()].map(([id, name]) => ({ id, name })).sort(byName),
  }
}

/** The active-state bucket a fountain falls into. */
export function activeStateOf(f: Fountain): ActiveState {
  if (f.isActive === true) return 'active'
  if (f.isActive === false) return 'inactive'
  return 'unknown'
}

/** Whether a fountain's location falls inside the given viewport bounds. */
export function isInBounds(f: Fountain, bounds: Bounds): boolean {
  const [lng, lat] = f.location
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
  )
}

export function applyFilters(fountains: Fountain[], filters: FilterState): Fountain[] {
  const search = filters.search.trim().toLowerCase()

  return fountains.filter((f) => {
    if (filters.activeStates.length > 0 && !filters.activeStates.includes(activeStateOf(f))) {
      return false
    }
    if (filters.districtNumber !== null && String(f.districtNumber) !== filters.districtNumber) {
      return false
    }
    if (filters.sourceIds.length > 0 && !filters.sourceIds.includes(String(f.source))) return false
    if (filters.statusIds.length > 0 && !filters.statusIds.includes(f.status ?? '')) return false
    if (
      filters.activationTypeIds.length > 0 &&
      !filters.activationTypeIds.includes(f.activationType ?? '')
    ) {
      return false
    }
    if (filters.ownerIds.length > 0 && !filters.ownerIds.includes(String(f.owner))) return false
    if (filters.hasActiveSignals && f.activeSignalCount === 0) return false
    if (search && !f.address.toLowerCase().includes(search)) return false
    return true
  })
}

/**
 * Marker color: red = not working, orange = has active signals, green = working,
 * gray = unknown. A non-working fountain (red) outranks an active signal.
 */
export function getMarkerColor(f: Fountain): string {
  if (f.isActive === false) return '#EF4444'
  if (f.activeSignalCount > 0) return '#F97316'
  if (f.isActive === true) return '#0284C7'
  return '#9CA3AF'
}
