'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isCityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import { SofiaGerbMark } from '@/components/AdminBrand/SofiaGerbMark'
import {
  Bounds,
  ContainerWithSignals,
  EMPTY_FILTERS,
  FilterState,
  MapItem,
  MarkerPoint,
  applyFilters,
} from './types'
import { MapFilters } from './MapFilters'
import { ContainerPopup } from './ContainerPopup'
import { BulkActionBar } from './BulkActionBar'
import { CreatePinHint } from './CreatePinHint'

// Dynamically import the map to avoid SSR issues
const ContainerMap = dynamic(
  () => import('./ContainerMap').then((m) => ({ default: m.ContainerMap })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#6B7280',
          fontSize: 14,
        }}
      >
        Зареждане на картата…
      </div>
    ),
  }
)

interface NewPinLocation {
  lat: number
  lng: number
  screenX: number
  screenY: number
}

const WasteContainerMapView: React.FC = () => {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const hasAccess = isCityInfrastructureAdmin(user?.role)
  const [items, setItems] = useState<MapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedContainer, setSelectedContainer] = useState<ContainerWithSignals | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [newPin, setNewPin] = useState<NewPinLocation | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef<FilterState>(filters)
  const lastViewportRef = useRef<{ zoom: number; bounds: Bounds } | null>(null)

  const initialZoom = useMemo(() => {
    const zoomParam = Number(searchParams.get('zoom') ?? 12)

    if (Number.isFinite(zoomParam)) {
      return Math.max(1, Math.min(18, Math.round(zoomParam)))
    }

    const hasDayFilter = Boolean(searchParams.get('createdFrom') && searchParams.get('createdTo'))
    return hasDayFilter ? 16 : 12
  }, [searchParams])

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  const fetchData = useCallback(async (zoom: number, bounds: Bounds) => {
    lastViewportRef.current = { zoom, bounds }
    setLoading(true)
    setError(null)
    try {
      const f = filtersRef.current
      const params = new URLSearchParams({
        zoom: String(zoom),
        minLat: String(bounds.minLat),
        maxLat: String(bounds.maxLat),
        minLng: String(bounds.minLng),
        maxLng: String(bounds.maxLng),
        ...(f.statuses.length > 0 && { statuses: f.statuses.join(',') }),
        ...(f.wasteTypes.length > 0 && { wasteTypes: f.wasteTypes.join(',') }),
        ...(f.districtId && { districtId: f.districtId }),
        ...(f.hasActiveSignals && { hasActiveSignals: 'true' }),
        ...(f.createdFrom && { createdFrom: f.createdFrom }),
        ...(f.createdTo && { createdTo: f.createdTo }),
        ...(f.lastCleanedFrom && { lastCleanedFrom: f.lastCleanedFrom }),
        ...(f.lastCleanedTo && { lastCleanedTo: f.lastCleanedTo }),
        ...(f.lastCleanedIsNull && { lastCleanedIsNull: 'true' }),
        ...(f.scheduledToday && { scheduledToday: 'true' }),
        ...(f.scheduleCategory && { scheduleCategory: f.scheduleCategory }),
        ...(f.signalStatus && { signalStatus: f.signalStatus }),
        ...(f.signalContainerState && { signalContainerState: f.signalContainerState }),
        ...(f.signalAgeBucket && { signalAgeBucket: f.signalAgeBucket }),
      })
      const res = await fetch(`/api/waste-containers/containers-with-signal-count?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.docs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неуспешно зареждане')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleViewportChange = useCallback(
    (zoom: number, bounds: Bounds) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchData(zoom, bounds), 300)
    },
    [fetchData]
  )

  // Re-fetch with current filters whenever they change (using last known viewport)
  useEffect(() => {
    const vp = lastViewportRef.current
    if (!vp) return
    void Promise.resolve().then(() => fetchData(vp.zoom, vp.bounds))
  }, [filters, fetchData])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  useEffect(() => {
    const status = searchParams.get('status')
    const createdFrom = searchParams.get('createdFrom')
    const createdTo = searchParams.get('createdTo')
    const zoneNumber = searchParams.get('zoneNumber')
    const lastCleanedFrom = searchParams.get('lastCleanedFrom')
    const lastCleanedTo = searchParams.get('lastCleanedTo')
    const lastCleanedIsNull = searchParams.get('lastCleanedIsNull') === 'true'
    const scheduledToday = searchParams.get('scheduledToday') === 'true'
    const scheduleCategory = searchParams.get('scheduleCategory')
    const signalStatus = searchParams.get('signalStatus')
    const signalContainerState = searchParams.get('signalContainerState')
    const signalAgeBucket = searchParams.get('signalAgeBucket')

    if (
      !status &&
      !createdFrom &&
      !createdTo &&
      !zoneNumber &&
      !lastCleanedFrom &&
      !lastCleanedTo &&
      !lastCleanedIsNull &&
      !scheduledToday &&
      !scheduleCategory &&
      !signalStatus &&
      !signalContainerState &&
      !signalAgeBucket
    )
      return

    void Promise.resolve().then(() => {
      setFilters((prev) => ({
        ...prev,
        statuses: status ? [status] : prev.statuses,
        createdFrom: createdFrom ?? prev.createdFrom,
        createdTo: createdTo ?? prev.createdTo,
        zoneNumber: zoneNumber ?? prev.zoneNumber,
        lastCleanedFrom: lastCleanedFrom ?? prev.lastCleanedFrom,
        lastCleanedTo: lastCleanedTo ?? prev.lastCleanedTo,
        lastCleanedIsNull: lastCleanedIsNull || prev.lastCleanedIsNull,
        scheduledToday: scheduledToday || prev.scheduledToday,
        scheduleCategory: scheduleCategory ?? prev.scheduleCategory,
        signalStatus: signalStatus ?? prev.signalStatus,
        signalContainerState: signalContainerState ?? prev.signalContainerState,
        signalAgeBucket: signalAgeBucket ?? prev.signalAgeBucket,
      }))
    })
  }, [searchParams])

  const isClustered = items.length > 0 && items[0]?.type === 'cluster'
  const markers = useMemo(() => items.filter((i): i is MarkerPoint => i.type === 'marker'), [items])
  const filtered = useMemo(() => applyFilters(markers, filters), [markers, filters])
  const displayItems = useMemo<MapItem[]>(
    () => (isClustered ? items : filtered),
    [isClustered, items, filtered]
  )

  const handleMarkerClick = useCallback(
    (container: ContainerWithSignals) => {
      if (selectMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(container.id)) next.delete(container.id)
          else next.add(container.id)
          return next
        })
      } else {
        setSelectedContainer(container)
        setNewPin(null)
      }
    },
    [selectMode]
  )

  const handleMapClick = useCallback(
    (lat: number, lng: number, screenX: number, screenY: number) => {
      if (!selectMode) {
        setSelectedContainer(null)
        setNewPin({ lat, lng, screenX, screenY })
      }
    },
    [selectMode]
  )

  const handleContainerUpdated = useCallback((updated: ContainerWithSignals) => {
    setItems((prev) =>
      prev.map((item) =>
        item.type === 'marker' && item.id === updated.id
          ? { ...updated, type: 'marker' as const }
          : item
      )
    )
    setSelectedContainer(updated)
  }, [])

  const handleBulkUpdate = useCallback(async (ids: number[], status: string) => {
    const res = await fetch('/api/waste-containers/bulk-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setItems((prev) =>
      prev.map((item) =>
        item.type === 'marker' && ids.includes(item.id)
          ? { ...item, status: status as ContainerWithSignals['status'] }
          : item
      )
    )
    setSelectedIds(new Set())
    setSelectMode(false)
  }, [])

  const handleAddressNavigate = useCallback(async () => {
    const query = addressQuery.trim()
    if (!query) {
      setAddressError('Въведете адрес или място')
      return
    }

    setAddressLoading(true)
    setAddressError(null)
    try {
      const params = new URLSearchParams({
        q: `${query}, Sofia, Bulgaria`,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'bg',
        addressdetails: '0',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const results = (await res.json()) as Array<{ lat: string; lon: string }>
      const first = results[0]
      if (!first) {
        setAddressError('Адресът не беше открит')
        return
      }
      const lat = Number(first.lat)
      const lng = Number(first.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setAddressError('Невалидни координати от търсене')
        return
      }
      setFlyToTarget([lat, lng])
      setSelectedContainer(null)
      setNewPin(null)
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : 'Неуспешно търсене на адрес')
    } finally {
      setAddressLoading(false)
    }
  }, [addressQuery])

  if (!hasAccess) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
          padding: 24,
          color: 'var(--theme-text)',
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Нямате достъп до картата на контейнерите.
        <Link
          href="/admin/login"
          style={{
            marginTop: 16,
            display: 'inline-block',
            padding: '8px 20px',
            background: '#2F54C5',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Влезте в профила си
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--theme-elevation-200, #E5E7EB)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SofiaGerbMark size={44} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              Административна карта на контейнерите за отпадъци
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7280', minHeight: '1.4em' }}>
              {items.length > 0
                ? isClustered
                  ? `${items.length} групи — приближете за детайли`
                  : `${filtered.length} от ${markers.length} контейнера`
                : '\u00a0'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={addressQuery}
                placeholder="Навигация по адрес (напр. бул. Витоша 1)"
                onChange={(e) => {
                  setAddressQuery(e.target.value)
                  if (addressError) setAddressError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddressNavigate()
                  }
                }}
                style={{
                  width: 300,
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fff',
                  color: '#374151',
                }}
              />
              <button
                onClick={() => void handleAddressNavigate()}
                disabled={addressLoading}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  background: addressLoading ? '#E5E7EB' : '#fff',
                  color: '#374151',
                  cursor: addressLoading ? 'default' : 'pointer',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {addressLoading ? 'Търсене…' : 'Отиди'}
              </button>
            </div>
            <p style={{ margin: 0, minHeight: '1.2em', fontSize: 12, color: '#DC2626' }}>
              {addressError ?? '\u00a0'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <MapFilters filters={filters} onChange={setFilters} />

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onStatusChange={(status: string) => handleBulkUpdate(Array.from(selectedIds), status)}
          onCancel={() => {
            setSelectedIds(new Set())
            setSelectMode(false)
          }}
        />
      )}

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 500,
              background: 'rgba(0,0,0,0.45)',
              color: '#fff',
              fontSize: 12,
              padding: '3px 9px',
              borderRadius: 6,
              pointerEvents: 'none',
            }}
          >
            Зареждане…
          </div>
        )}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              zIndex: 500,
              gap: 12,
            }}
          >
            <p style={{ color: '#DC2626', margin: 0 }}>Грешка: {error}</p>
          </div>
        )}
        {!error && (
          <ContainerMap
            items={displayItems}
            selectedIds={selectedIds}
            selectedContainerId={selectedContainer?.id ?? null}
            selectMode={selectMode}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClick}
            onViewportChange={handleViewportChange}
            flyToTarget={flyToTarget}
            initialZoom={initialZoom}
          />
        )}

        {/* Popup overlay */}
        {selectedContainer && !selectMode && (
          <ContainerPopup
            container={selectedContainer}
            onClose={() => setSelectedContainer(null)}
            onContainerUpdated={handleContainerUpdated}
          />
        )}

        {/* Create pin hint */}
        {newPin && !selectMode && (
          <CreatePinHint
            lat={newPin.lat}
            lng={newPin.lng}
            screenX={newPin.screenX}
            screenY={newPin.screenY}
            onDismiss={() => setNewPin(null)}
          />
        )}
      </div>
    </div>
  )
}

export default WasteContainerMapView
