'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { PayloadRequest } from 'payload'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'
import { SofiaGerbMark } from '@/components/AdminBrand/SofiaGerbMark'
import { colors } from '@/cssVariables'
import {
  Bounds,
  EMPTY_FILTERS,
  FILTER_QUERY_KEYS,
  FilterState,
  Fountain,
  Lookups,
  applyFilters,
  filtersToQuery,
  isInBounds,
  parseFiltersFromParams,
} from './types'
import { MapFilters } from './MapFilters'
import { FountainPopup } from './FountainPopup'
import { CreatePinHint } from './CreatePinHint'

const FountainMap = dynamic(
  () => import('./FountainMap').then((m) => ({ default: m.FountainMap })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: colors.textSecondary,
          fontSize: 14,
        }}
      >
        Зареждане на картата…
      </div>
    ),
  }
)

const EMPTY_LOOKUPS: Lookups = { sources: [], statuses: [], activationTypes: [], owners: [] }

interface NewPinLocation {
  lat: number
  lng: number
  screenX: number
  screenY: number
}

const DrinkingFountainMapView: React.FC = () => {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const hasAccess = canViewFountains({ req: { user } } as { req: PayloadRequest })
  const canAddFountain = canManageFountains(user?.role)

  const [fountains, setFountains] = useState<Fountain[]>([])
  const [total, setTotal] = useState(0)
  const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [urlHydrated, setUrlHydrated] = useState(false)
  const [selected, setSelected] = useState<Fountain | null>(null)
  const [newPin, setNewPin] = useState<NewPinLocation | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)

  // Load filters once on page load from the URL query string, if present. Done
  // only once so it doesn't overwrite the user's later changes to the filters.
  useEffect(() => {
    const parsed = parseFiltersFromParams(new URLSearchParams(searchParams.toString()))
    void Promise.resolve().then(() => {
      if (Object.keys(parsed).length > 0) {
        setFilters((prev) => ({ ...prev, ...parsed }))
      }
      setUrlHydrated(true)
    })
    // Intentionally run once — subsequent URL updates are driven by the sync
    // effect below, not read back into state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect the current filter state back into the URL so it survives reloads
  // and can be shared. Preserves any unrelated params.
  useEffect(() => {
    if (!urlHydrated) return
    const params = new URLSearchParams(searchParams.toString())
    FILTER_QUERY_KEYS.forEach((key) => params.delete(key))
    filtersToQuery(filters).forEach((value, key) => params.set(key, value))
    const next = params.toString()
    if (next === searchParams.toString()) return
    // Keep commas readable in the URL — they're valid unencoded in a query string.
    const pretty = next.replace(/%2C/g, ',')
    router.replace(pretty ? `${pathname}?${pretty}` : pathname, { scroll: false })
  }, [filters, urlHydrated, pathname, router, searchParams])

  // Load every fountain once. Filtering runs client-side over the full dataset
  // (not just the viewport) so the filter counts reflect all fountains.
  useEffect(() => {
    if (!hasAccess) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/drinking-fountains/map-data')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { docs?: Fountain[]; total?: number }
        if (cancelled) return
        const docs = data.docs ?? []
        setFountains(docs)
        setTotal(typeof data.total === 'number' ? data.total : docs.length)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Неуспешно зареждане')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasAccess])

  // Fetch the full lookup lists once so admins can reassign any value while editing.
  useEffect(() => {
    if (!hasAccess || !canAddFountain) return
    let cancelled = false
    const load = async (slug: string) => {
      const res = await fetch(`/api/${slug}?limit=200&sort=name&depth=0`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { docs?: Array<{ id: number; name: string }> }
      return (data.docs ?? []).map((d) => ({ id: d.id, name: d.name }))
    }
    void (async () => {
      try {
        const [sources, statuses, activationTypes, owners] = await Promise.all([
          load('drinking-fountain-source'),
          load('fountain-status'),
          load('fountain-activation-type'),
          load('fountain-owner'),
        ])
        if (!cancelled) setLookups({ sources, statuses, activationTypes, owners })
      } catch {
        // Non-fatal — editing selects just fall back to empty option lists.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasAccess, canAddFountain])

  // Filters apply across the whole dataset; `visible` narrows to the viewport
  // only for the header count (how many of the filtered fountains are on screen).
  const filtered = useMemo(() => applyFilters(fountains, filters), [fountains, filters])
  const visibleCount = useMemo(
    () => (bounds ? filtered.filter((f) => isInBounds(f, bounds)).length : filtered.length),
    [filtered, bounds]
  )

  const handleViewportChange = useCallback((_zoom: number, next: Bounds) => {
    setBounds(next)
  }, [])

  const handleMarkerClick = useCallback((fountain: Fountain) => {
    setSelected(fountain)
    setNewPin(null)
  }, [])

  const handleMapClick = useCallback(
    (lat: number, lng: number, screenX: number, screenY: number) => {
      // Clicking empty map deselects any open popup, then offers to add a fountain.
      setSelected(null)
      if (canAddFountain) setNewPin({ lat, lng, screenX, screenY })
    },
    [canAddFountain]
  )

  const handleFountainUpdated = useCallback((updated: Fountain) => {
    setFountains((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setSelected(updated)
  }, [])

  const handleFountainDeleted = useCallback((id: number) => {
    setFountains((prev) => prev.filter((f) => f.id !== id))
    setSelected(null)
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
      setSelected(null)
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
        Нямате достъп до картата на чешмите.
        <Link
          href="/admin/login"
          style={{
            marginTop: 16,
            display: 'inline-block',
            padding: '8px 20px',
            background: colors.primary,
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
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: colors.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SofiaGerbMark size={44} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
              Административна карта на чешмите
            </h1>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 13,
                color: colors.textMuted,
                minHeight: '1.4em',
              }}
            >
              {total > 0
                ? filtered.length === total
                  ? `${visibleCount} от ${total} общо`
                  : `${visibleCount} от ${filtered.length} филтрирани (${total} общо)`
                : '\u00A0'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                border: `1px solid ${colors.border}`,
                fontSize: 13,
                outline: 'none',
                background: colors.surface,
                color: colors.textSecondary,
              }}
            />
            <button
              onClick={() => void handleAddressNavigate()}
              disabled={addressLoading}
              style={{
                padding: '7px 12px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: addressLoading ? colors.surface2 : colors.surface,
                color: colors.textSecondary,
                cursor: addressLoading ? 'default' : 'pointer',
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}
            >
              {addressLoading ? 'Търсене…' : 'Отиди'}
            </button>
          </div>
          <p style={{ margin: 0, minHeight: '1.2em', fontSize: 12, color: colors.error }}>
            {addressError ?? ' '}
          </p>
        </div>
      </div>

      {/* Filters */}
      <MapFilters filters={filters} onChange={setFilters} fountains={fountains} />

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
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.surface,
              zIndex: 500,
            }}
          >
            <p style={{ color: colors.error, margin: 0 }}>Грешка: {error}</p>
          </div>
        )}
        {!error && (
          <FountainMap
            fountains={filtered}
            selectedId={selected?.id ?? null}
            onMapClick={handleMapClick}
            onViewportChange={handleViewportChange}
            onMarkerClick={handleMarkerClick}
            flyToTarget={flyToTarget}
          />
        )}

        {selected && (
          <FountainPopup
            fountain={selected}
            lookups={lookups}
            onClose={() => setSelected(null)}
            onFountainUpdated={handleFountainUpdated}
            onFountainDeleted={handleFountainDeleted}
          />
        )}

        {newPin && canAddFountain && (
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

export default DrinkingFountainMapView
