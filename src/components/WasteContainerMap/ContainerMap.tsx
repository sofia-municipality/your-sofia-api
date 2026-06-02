'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React, { useCallback, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { colors } from '@/cssVariables'
import { Bounds, ClusterPoint, ContainerWithSignals, MapItem, getMarkerColor } from './types'

// Fix Leaflet's broken default marker icons when bundled with webpack/Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl']
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SOFIA_LAT = 42.6977
const SOFIA_LNG = 23.3219

function createColorIcon(color: string, selected: boolean): L.DivIcon {
  const headSize = selected ? 36 : 28
  const pointSize = selected ? 16 : 12
  const width = headSize + 8
  const height = headSize + pointSize + 10
  const borderWidth = selected ? 3 : 2
  const borderColor = selected ? colors.primaryDark : 'rgba(0,0,0,0.3)'
  const iconSize = selected ? 18 : 14
  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:${width}px;
      height:${height}px;
    ">
      <div style="
        position:absolute;
        left:50%;
        top:0;
        width:${headSize}px;
        height:${headSize}px;
        transform:translateX(-50%);
        border-radius:999px;
        background:${color};
        border:${borderWidth}px solid ${borderColor};
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
        color:#fff;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/>
          <path d="M10 21.9V14L2.1 9.1"/>
          <path d="m10 14 11.9-6.9"/>
          <path d="M14 19.8v-8.1"/>
          <path d="M18 17.5V9.4"/>
        </svg>
      </div>
      <div style="
        position:absolute;
        left:50%;
        top:${headSize - 8}px;
        width:${pointSize}px;
        height:${pointSize}px;
        transform:translateX(-50%) rotate(45deg);
        background:${color};
        border-right:${borderWidth}px solid ${borderColor};
        border-bottom:${borderWidth}px solid ${borderColor};
        box-shadow:2px 2px 4px rgba(0,0,0,0.18);
      "></div>
    </div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  })
}

function createClusterIcon(cluster: ClusterPoint): L.DivIcon {
  const { count, dominantStatus, activeSignalCount } = cluster
  const color =
    dominantStatus === 'inactive' || dominantStatus === 'pending'
      ? colors.textMuted
      : activeSignalCount > 0
        ? colors.warning
        : dominantStatus === 'full' || dominantStatus === 'maintenance'
          ? colors.error
          : colors.success
  const size = count >= 1000 ? 52 : count >= 100 ? 44 : count >= 10 ? 36 : 28
  const label = count >= 1000 ? `${Math.floor(count / 1000)}k+` : String(count)
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${size >= 44 ? 13 : 11}px;
      font-family:sans-serif;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number, screenX: number, screenY: number) => void
}

function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  const mapRef = useRef<L.Map | null>(null)
  useMapEvents({
    load(e) {
      mapRef.current = e.target
    },
    click(e) {
      const orig = e.originalEvent as MouseEvent
      onMapClick(e.latlng.lat, e.latlng.lng, orig.clientX, orig.clientY)
    },
  })
  return null
}

function ViewportTracker({
  onViewportChange,
}: {
  onViewportChange: (zoom: number, bounds: Bounds) => void
}) {
  const map = useMap()

  useEffect(() => {
    const b = map.getBounds()
    onViewportChange(map.getZoom(), {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMapEvents({
    moveend(e) {
      const b = e.target.getBounds()
      onViewportChange(e.target.getZoom(), {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      })
    },
    zoomend(e) {
      const b = e.target.getBounds()
      onViewportChange(e.target.getZoom(), {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      })
    },
  })
  return null
}

function FlyToTarget({ target }: { target: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [map, target])

  return null
}

/**
 * MarkersLayer — uses two Leaflet LayerGroups (double-buffer) to swap marker sets
 * without ever leaving the map blank. While the front group stays visible, the back
 * group is populated with the new markers. Then both are swapped in one synchronous
 * JS call so there is no empty frame.
 */
function MarkersLayer({
  items,
  selectedIds,
  selectedContainerId,
  onMarkerClick,
  uncollectedMode,
}: {
  items: MapItem[]
  selectedIds: Set<number>
  selectedContainerId: number | null
  onMarkerClick: (container: ContainerWithSignals) => void
  uncollectedMode?: boolean
}) {
  const map = useMap()
  const groupsRef = useRef<[L.LayerGroup, L.LayerGroup]>([L.layerGroup(), L.layerGroup()])
  const frontRef = useRef<0 | 1>(0)
  // Keep a stable ref to the callback so marker closures always call the latest version
  const onMarkerClickRef = useRef(onMarkerClick)

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  // Mount / unmount both groups with the map lifetime
  useEffect(() => {
    const [g0] = groupsRef.current
    g0.addTo(map)
    return () => {
      groupsRef.current[0].remove()
      groupsRef.current[1].remove()
    }
  }, [map])

  // Whenever items or selection changes, rebuild the back group then swap
  useEffect(() => {
    const groups = groupsRef.current
    const front = frontRef.current
    const back: 0 | 1 = front === 0 ? 1 : 0
    const backGroup = groups[back]

    // Populate back group while it is off the map
    backGroup.clearLayers()
    items.forEach((item) => {
      if (item.type === 'cluster') {
        const marker = L.marker([item.lat, item.lng], { icon: createClusterIcon(item) })
        marker.on('click', () => map.setView([item.lat, item.lng], map.getZoom() + 3))
        backGroup.addLayer(marker)
      } else {
        const [lng, lat] = item.location
        const color = getMarkerColor(item, uncollectedMode)
        const selected = selectedIds.has(item.id) || item.id === selectedContainerId
        const marker = L.marker([lat, lng], { icon: createColorIcon(color, selected) })
        marker.on('click', () => onMarkerClickRef.current(item))
        backGroup.addLayer(marker)
      }
    })

    // Atomic swap — synchronous, so no blank frame between the two operations
    backGroup.addTo(map)
    groups[front].remove()
    frontRef.current = back
  }, [items, selectedIds, selectedContainerId, map, uncollectedMode])

  return null
}

interface ContainerMapProps {
  items: MapItem[]
  selectedIds: Set<number>
  selectedContainerId: number | null
  onMarkerClick: (container: ContainerWithSignals) => void
  onMapClick: (lat: number, lng: number, screenX: number, screenY: number) => void
  onViewportChange: (zoom: number, bounds: Bounds) => void
  flyToTarget: [number, number] | null
  initialZoom?: number
  uncollectedMode?: boolean
}

export function ContainerMap({
  items,
  selectedIds,
  selectedContainerId,
  onMarkerClick,
  onMapClick,
  onViewportChange,
  flyToTarget,
  initialZoom = 12,
  uncollectedMode,
}: ContainerMapProps) {
  const handleMapClick = useCallback(
    (lat: number, lng: number, screenX: number, screenY: number) => {
      onMapClick(lat, lng, screenX, screenY)
    },
    [onMapClick]
  )

  return (
    <MapContainer
      center={[SOFIA_LAT, SOFIA_LNG]}
      zoom={initialZoom}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onMapClick={handleMapClick} />
      <FlyToTarget target={flyToTarget} />
      <ViewportTracker onViewportChange={onViewportChange} />
      <MarkersLayer
        items={items}
        selectedIds={selectedIds}
        selectedContainerId={selectedContainerId}
        onMarkerClick={onMarkerClick}
        uncollectedMode={uncollectedMode}
      />
    </MapContainer>
  )
}
