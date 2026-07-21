'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { colors } from '@/cssVariables'
import { formatClusterCount } from '@/utilities/mapUtils'
import { Bounds, Fountain, getMarkerColor } from './types'

// Fix Leaflet's broken default marker icons when bundled with webpack/Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl']
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number, screenX: number, screenY: number) => void
}

interface FountainMapProps {
  fountains: Fountain[]
  selectedId: number | null
  onMarkerClick: (fountain: Fountain) => void
  onMapClick: (lat: number, lng: number, screenX: number, screenY: number) => void
  onViewportChange: (zoom: number, bounds: Bounds) => void
  flyToTarget: [number, number] | null
  initialZoom?: number
}

const SOFIA_LAT = 42.6977
const SOFIA_LNG = 23.3219

function createDropletIcon(color: string, selected: boolean): L.DivIcon {
  const headSize = selected ? 38 : 30
  const borderWidth = selected ? 3 : 2
  const borderColor = selected ? colors.primaryDark : 'rgba(0,0,0,0.3)'
  const iconSize = selected ? 18 : 14

  const width = headSize
  const height = headSize

  return L.divIcon({
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    className: 'map-marker',
    html: `
<div style="position:relative;width:${width}px;height:${height}px;">
  <div
    style="
      position:absolute;
      left:50%;
      top:0;
      width:${headSize}px;
      height:${headSize}px;
      transform: translateX(-50%) rotate(-45deg) scale(${selected ? 1.1 : 1});
      transform-origin:center;
      background:${color};
      border:${borderWidth}px solid ${borderColor};
      border-radius:50% 50% 50% 0;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      transition: transform .5s ease;
    "
  >
    <div
      style="
        width:100%;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#fff;
        transform:rotate(45deg);
      "
    >
     <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${iconSize}"
    height="${iconSize}"
    viewBox="0 0 512 512"
    fill="currentColor"
><g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="currentColor" > <path d="M3055 5106 c-206 -41 -397 -168 -502 -334 -20 -31 -37 -58 -38 -60 -1 -1 -37 15 -80 37 -245 126 -522 83 -716 -109 -59 -58 -85 -94 -118 -160 -67 -137 -87 -269 -52 -345 47 -104 169 -137 257 -70 45 35 62 69 74 155 17 117 67 188 164 231 135 59 289 0 352 -136 l24 -50 0 -473 0 -474 -32 8 c-55 12 -176 6 -231 -12 -199 -64 -337 -246 -337 -443 0 -68 20 -112 66 -147 32 -25 46 -29 103 -29 53 0 72 5 99 23 37 27 72 89 72 128 0 15 9 47 20 70 42 86 148 98 215 24 19 -21 20 -40 25 -289 l5 -266 173 -3 172 -2 0 532 c0 488 2 536 18 567 26 52 65 76 120 75 84 -1 121 -41 141 -148 18 -100 81 -156 173 -156 96 1 168 77 168 181 0 199 -151 395 -352 453 -62 18 -185 21 -236 7 l-32 -10 0 247 c0 342 17 410 132 525 130 131 355 156 511 57 117 -74 180 -178 202 -334 15 -108 35 -145 95 -176 50 -26 103 -25 157 1 88 43 113 139 78 304 -58 280 -270 506 -547 585 -94 27 -249 34 -343 16z"/> <path d="M1593 3834 c-45 -22 -75 -74 -75 -129 0 -159 218 -200 277 -53 50 125 -80 242 -202 182z"/> <path d="M3844 3836 c-76 -34 -105 -145 -55 -215 43 -61 124 -78 191 -40 48 27 70 66 70 124 0 58 -22 97 -70 124 -43 24 -91 26 -136 7z"/> <path d="M3187 2986 c-48 -18 -62 -29 -81 -70 -38 -80 -8 -163 70 -198 129 -57 252 79 183 202 -35 63 -105 90 -172 66z"/> <path d="M492 2120 c-44 -27 -72 -76 -72 -127 0 -33 15 -73 65 -170 36 -71 87 -159 113 -198 l48 -70 1914 0 1914 0 48 70 c26 39 77 127 113 198 50 97 65 137 65 170 0 51 -28 100 -72 127 -33 20 -55 20 -2068 20 -2013 0 -2035 0 -2068 -20z"/> <path d="M901 1274 c7 -9 50 -44 94 -79 313 -244 684 -394 1140 -462 172 -25 678 -25 850 0 456 68 827 218 1140 462 44 35 87 70 94 79 12 15 -120 16 -1659 16 -1539 0 -1671 -1 -1659 -16z"/> <path d="M1794 511 c-32 -73 -54 -159 -65 -256 -11 -93 -11 -103 8 -146 12 -26 37 -59 59 -75 l37 -29 727 0 727 0 37 29 c22 16 47 49 59 75 19 43 19 53 8 146 -11 97 -33 183 -65 256 l-15 37 -88 -18 c-408 -83 -918 -83 -1326 0 l-88 18 -15 -37z"/> </g> </svg>
        </div>
      </div>
    `,
  })
}

// Zoom at which clusters give way to individual fountain markers.
const INDIVIDUAL_ZOOM = 16

// Grid cell size in degrees per zoom level (mirrors the waste map's clustering).
function getGridSize(zoom: number): number {
  const sizes: Record<number, number> = {
    10: 0.5,
    11: 0.25,
    12: 0.1,
    13: 0.05,
    14: 0.02,
    15: 0.01,
  }
  return sizes[Math.min(Math.max(zoom, 10), 15)] ?? 0.5
}

interface FountainCluster {
  lat: number
  lng: number
  count: number
  color: string
}

// The most severe state present wins the cluster's color: red (not working)
// over orange (has active signals) over green (working) over gray (unknown).
function clusterColor(inactive: number, withSignals: number, active: number): string {
  if (inactive > 0) return '#EF4444'
  if (withSignals > 0) return '#F97316'
  if (active > 0) return '#0284C7'
  return '#9CA3AF'
}

/**
 * Group fountains into a lng/lat grid for the current zoom. Cells with a single
 * fountain are returned as `singles` (rendered as normal markers); cells with
 * more become a cluster positioned at the cell's centroid.
 */
function buildClusters(
  fountains: Fountain[],
  gridSize: number
): { clusters: FountainCluster[]; singles: Fountain[] } {
  const cells = new Map<
    string,
    {
      latSum: number
      lngSum: number
      items: Fountain[]
      inactive: number
      withSignals: number
      active: number
    }
  >()
  for (const f of fountains) {
    const [lng, lat] = f.location
    const key = `${Math.round(lng / gridSize)}:${Math.round(lat / gridSize)}`
    let cell = cells.get(key)
    if (!cell) {
      cell = { latSum: 0, lngSum: 0, items: [], inactive: 0, withSignals: 0, active: 0 }
      cells.set(key, cell)
    }
    cell.latSum += lat
    cell.lngSum += lng
    cell.items.push(f)
    if (f.isActive === false) cell.inactive++
    else if (f.activeSignalCount > 0) cell.withSignals++
    else if (f.isActive === true) cell.active++
  }

  const clusters: FountainCluster[] = []
  const singles: Fountain[] = []
  for (const cell of cells.values()) {
    const single = cell.items.length === 1 ? cell.items[0] : undefined
    if (single) {
      singles.push(single)
    } else {
      clusters.push({
        lat: cell.latSum / cell.items.length,
        lng: cell.lngSum / cell.items.length,
        count: cell.items.length,
        color: clusterColor(cell.inactive, cell.withSignals, cell.active),
      })
    }
  }
  return { clusters, singles }
}

function createFountainClusterIcon(count: number, color: string): L.DivIcon {
  const size = count >= 1000 ? 52 : count >= 100 ? 44 : count >= 10 ? 36 : 28
  const label = formatClusterCount(count)
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${size >= 44 ? 13 : 11}px;font-family:sans-serif;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function addFountainMarker(
  group: L.LayerGroup,
  f: Fountain,
  selected: boolean,
  onClick: (f: Fountain) => void
) {
  const [lng, lat] = f.location
  const marker = L.marker([lat, lng], { icon: createDropletIcon(getMarkerColor(f), selected) })
  marker.on('click', () => onClick(f))
  group.addLayer(marker)
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
 * MarkersLayer — double-buffers two Leaflet LayerGroups so the marker set can be
 * swapped (on viewport pan / filter change) without ever leaving the map blank.
 */
function MarkersLayer({
  fountains,
  selectedId,
  onMarkerClick,
}: {
  fountains: Fountain[]
  selectedId: number | null
  onMarkerClick: (fountain: Fountain) => void
}) {
  const map = useMap()
  const groupsRef = useRef<[L.LayerGroup, L.LayerGroup]>([L.layerGroup(), L.layerGroup()])
  const frontRef = useRef<0 | 1>(0)
  const onMarkerClickRef = useRef(onMarkerClick)
  const [zoom, setZoom] = useState(() => map.getZoom())

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  useMapEvents({
    zoomend(e) {
      setZoom(e.target.getZoom())
    },
  })

  useEffect(() => {
    const [g0] = groupsRef.current
    g0.addTo(map)
    return () => {
      groupsRef.current[0].remove()
      groupsRef.current[1].remove()
    }
  }, [map])

  useEffect(() => {
    const groups = groupsRef.current
    const front = frontRef.current
    const back: 0 | 1 = front === 0 ? 1 : 0
    const backGroup = groups[back]

    backGroup.clearLayers()

    if (zoom >= INDIVIDUAL_ZOOM) {
      // Zoomed in: every fountain as its own marker.
      fountains.forEach((f) => {
        addFountainMarker(backGroup, f, f.id === selectedId, (ff) => onMarkerClickRef.current(ff))
      })
    } else {
      // Zoomed out: grid-cluster nearby fountains, keep lone ones as markers.
      const { clusters, singles } = buildClusters(fountains, getGridSize(zoom))
      clusters.forEach((c) => {
        const marker = L.marker([c.lat, c.lng], {
          icon: createFountainClusterIcon(c.count, c.color),
        })
        marker.on('click', () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 3, 18)))
        backGroup.addLayer(marker)
      })
      singles.forEach((f) => {
        addFountainMarker(backGroup, f, f.id === selectedId, (ff) => onMarkerClickRef.current(ff))
      })
    }

    backGroup.addTo(map)
    groups[front].remove()
    frontRef.current = back
  }, [fountains, selectedId, map, zoom])

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

export function FountainMap({
  fountains,
  selectedId,
  onMapClick,
  onMarkerClick,
  onViewportChange,
  flyToTarget,
  initialZoom = 12,
}: FountainMapProps) {
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
      <ViewportTracker onViewportChange={onViewportChange} />
      <MapClickHandler onMapClick={handleMapClick} />
      <FlyToTarget target={flyToTarget} />
      <MarkersLayer fountains={fountains} selectedId={selectedId} onMarkerClick={onMarkerClick} />
    </MapContainer>
  )
}
