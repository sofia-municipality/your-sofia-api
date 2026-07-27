'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { BoundaryGeometry, LatLng } from './geo'
import { midpoint, ringFromValue, valueFromRing } from './geo'

// Default centre: Sofia city centre
const SOFIA_LAT = 42.6977
const SOFIA_LNG = 23.3219

const vertexIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#2F54C5;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const midpointIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:rgba(47,84,197,0.35);border:1px dashed #2F54C5;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

type BoundaryLeafletMapProps = {
  value: BoundaryGeometry | null
  /** Bumped by the parent when it changes the value programmatically (clear / paste),
   * so the map re-syncs its working ring only on external edits — never mid-drag. */
  revision: number
  canEdit: boolean
  onChange: (geometry: BoundaryGeometry | null) => void
}

/** Fit the map to the polygon the first time a non-empty ring is available or an
 * external change (revision bump) brings in a new one. */
function FitToRing({ ring, revision }: { ring: LatLng[]; revision: number }) {
  const map = useMap()
  const lastFitRevision = useRef<number | null>(null)

  useEffect(() => {
    if (ring.length < 2) return
    if (lastFitRevision.current === revision) return
    lastFitRevision.current = revision
    map.fitBounds(L.latLngBounds(ring.map(([lat, lng]) => L.latLng(lat, lng))), {
      padding: [30, 30],
      maxZoom: 17,
    })
  }, [map, ring, revision])

  return null
}

function MapClickAdder({ enabled, onAdd }: { enabled: boolean; onAdd: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onAdd([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export function BoundaryLeafletMap({
  value,
  revision,
  canEdit,
  onChange,
}: BoundaryLeafletMapProps) {
  // Initialised from the stored value on mount. The parent remounts this
  // component (via `key={revision}`) on external changes such as a GeoJSON
  // paste, so the initialiser re-reads the fresh value then; ordinary drag
  // edits do not bump the revision and therefore preserve this local state.
  const [ring, setRing] = useState<LatLng[]>(() => ringFromValue(value))
  // Default to "add" mode when there is nothing drawn yet.
  const [adding, setAdding] = useState<boolean>(() => ringFromValue(value).length < 3)
  const polygonRef = useRef<L.Polygon | null>(null)

  const commit = useCallback(
    (next: LatLng[]) => {
      setRing(next)
      onChange(valueFromRing(next))
    },
    [onChange]
  )

  const handleAddPoint = useCallback(
    (p: LatLng) => {
      commit([...ring, p])
    },
    [ring, commit]
  )

  const handleVertexDrag = useCallback(
    (index: number, latlng: L.LatLng) => {
      // Live-update the polygon shape while dragging without a React re-render
      // (avoids the controlled-marker snap-back), commit happens on dragend.
      const preview = ring.map((p, i): LatLng => (i === index ? [latlng.lat, latlng.lng] : p))
      polygonRef.current?.setLatLngs(preview as unknown as L.LatLngExpression[])
    },
    [ring]
  )

  const handleVertexDragEnd = useCallback(
    (index: number, latlng: L.LatLng) => {
      commit(ring.map((p, i): LatLng => (i === index ? [latlng.lat, latlng.lng] : p)))
    },
    [ring, commit]
  )

  const handleVertexRemove = useCallback(
    (index: number) => {
      if (ring.length <= 3) return
      commit(ring.filter((_, i) => i !== index))
    },
    [ring, commit]
  )

  const handleInsertAfter = useCallback(
    (index: number, p: LatLng) => {
      const next = [...ring]
      next.splice(index + 1, 0, p)
      commit(next)
    },
    [ring, commit]
  )

  const handleUndoLast = useCallback(() => {
    if (ring.length === 0) return
    commit(ring.slice(0, -1))
  }, [ring, commit])

  const handleClear = useCallback(() => {
    setRing([])
    setAdding(true)
    onChange(null)
  }, [onChange])

  const midpoints = useMemo(() => {
    if (ring.length < 2) return []
    return ring.map((p, i) => ({ index: i, point: midpoint(p, ring[(i + 1) % ring.length]!) }))
  }, [ring])

  const hasLocation = ring.length > 0
  const center: LatLng = hasLocation ? ring[0]! : [SOFIA_LAT, SOFIA_LNG]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={hasLocation ? 14 : 12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToRing ring={ring} revision={revision} />
        <MapClickAdder enabled={canEdit && adding} onAdd={handleAddPoint} />

        {ring.length >= 3 && (
          <Polygon
            ref={polygonRef}
            positions={ring}
            pathOptions={{ color: '#2F54C5', weight: 2, fillOpacity: 0.15 }}
          />
        )}
        {ring.length === 2 && (
          <Polyline
            positions={ring}
            pathOptions={{ color: '#2F54C5', weight: 2, dashArray: '4 4' }}
          />
        )}

        {canEdit &&
          !adding &&
          midpoints.map((m) => (
            <Marker
              key={`mid-${m.index}`}
              position={m.point}
              icon={midpointIcon}
              eventHandlers={{
                click() {
                  handleInsertAfter(m.index, m.point)
                },
              }}
            />
          ))}

        {canEdit &&
          ring.map((p, i) => (
            <Marker
              key={`v-${i}`}
              position={p}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                drag(e) {
                  handleVertexDrag(i, (e.target as L.Marker).getLatLng())
                },
                dragend(e) {
                  handleVertexDragEnd(i, (e.target as L.Marker).getLatLng())
                },
                contextmenu(e) {
                  ;(e.originalEvent as MouseEvent).preventDefault()
                  handleVertexRemove(i)
                },
              }}
            />
          ))}
      </MapContainer>

      {canEdit && (
        <div className="boundary-map-field__controls">
          <button
            type="button"
            className={`boundary-map-field__btn${adding ? ' boundary-map-field__btn--active' : ''}`}
            onClick={() => setAdding((a) => !a)}
            title="Кликвайте по картата, за да добавяте точки"
          >
            {adding ? 'Спри добавянето' : 'Добави точки'}
          </button>
          <button
            type="button"
            className="boundary-map-field__btn"
            onClick={handleUndoLast}
            disabled={ring.length === 0}
          >
            Върни последна точка
          </button>
          <button
            type="button"
            className="boundary-map-field__btn boundary-map-field__btn--danger"
            onClick={handleClear}
            disabled={ring.length === 0}
          >
            Изчисти
          </button>
        </div>
      )}

      {canEdit && adding && (
        <div className="boundary-map-field__hint-overlay">
          Кликнете по картата, за да добавяте точки. Плъзнете точка, за да я преместите; десен клик
          върху точка я премахва.
        </div>
      )}
    </div>
  )
}
