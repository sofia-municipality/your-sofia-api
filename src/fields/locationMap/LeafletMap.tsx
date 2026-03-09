'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'

// Fix Leaflet's broken default marker icons when bundled with webpack/Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl']
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Default centre: Sofia city centre
const SOFIA_LAT = 42.6977
const SOFIA_LNG = 23.3219

type LeafletMapProps = {
  lat: number | null
  lng: number | null
  canEdit: boolean
  onPositionChange: (lat: number, lng: number) => void
}

/** Inner component that listens to map click events and repositions the marker. */
function ClickHandler({
  canEdit,
  onPositionChange,
}: {
  canEdit: boolean
  onPositionChange: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      if (canEdit) {
        onPositionChange(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

export function LeafletMap({ lat, lng, canEdit, onPositionChange }: LeafletMapProps) {
  const hasLocation = lat !== null && lng !== null
  const centerLat = hasLocation ? lat! : SOFIA_LAT
  const centerLng = hasLocation ? lng! : SOFIA_LNG

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={hasLocation ? 16 : 12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler canEdit={canEdit} onPositionChange={onPositionChange} />
        {hasLocation && (
          <Marker
            position={[lat!, lng!]}
            draggable={canEdit}
            eventHandlers={
              canEdit
                ? {
                    dragend(e) {
                      const marker = e.target
                      const pos = marker.getLatLng()
                      onPositionChange(pos.lat, pos.lng)
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>
      {!hasLocation && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.85)',
            padding: '8px 16px',
            borderRadius: 4,
            pointerEvents: 'none',
            fontSize: 13,
            color: '#555',
          }}
        >
          {canEdit
            ? 'Кликнете на картата, за да зададете местоположение'
            : 'Няма зададено местоположение'}
        </div>
      )}
    </div>
  )
}
