'use client'

import { FieldLabel, useAuth, useField } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'
import dynamic from 'next/dynamic'
import React, { useCallback, useState } from 'react'
import { isCityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import type { BoundaryGeometry } from './geo'
import { parseBoundaryInput } from './geo'
import './index.scss'

// Dynamically import the Leaflet map to avoid SSR issues (Leaflet requires `window`)
const BoundaryLeafletMap = dynamic(
  () => import('./BoundaryLeafletMap').then((mod) => ({ default: mod.BoundaryLeafletMap })),
  {
    ssr: false,
    loading: () => <div className="boundary-map-field__loading">Зареждане на картата…</div>,
  }
)

export function BoundaryMapField({
  field,
  path,
  readOnly: readOnlyFromProps,
}: JSONFieldClientProps) {
  const { user } = useAuth()
  const fieldPath = path || field.name
  const { value, setValue, showError, errorMessage } = useField<BoundaryGeometry | null>({
    path: fieldPath,
  })

  const canEdit = !readOnlyFromProps && user != null && isCityInfrastructureAdmin(user.role)

  // Bumped whenever we change the value programmatically (clear / paste) so the
  // map re-syncs its working ring on external edits only, not on our own commits.
  const [revision, setRevision] = useState(0)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleMapChange = useCallback(
    (geometry: BoundaryGeometry | null) => {
      setValue(geometry)
    },
    [setValue]
  )

  const handleCopy = useCallback(async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — ignore
    }
  }, [value])

  const handleApplyImport = useCallback(() => {
    const geometry = parseBoundaryInput(importText)
    if (!geometry) {
      setImportError('Невалиден GeoJSON. Очаква се Polygon, Feature или FeatureCollection.')
      return
    }
    setValue(geometry)
    setRevision((r) => r + 1)
    setShowImport(false)
    setImportText('')
    setImportError(null)
  }, [importText, setValue])

  const pointCount = value?.coordinates?.[0]?.length ? value.coordinates[0].length - 1 : 0

  return (
    <div className="field-type boundary-map-field">
      <FieldLabel htmlFor={`field-${fieldPath}`} label={field.label} required={field.required} />

      <div className="boundary-map-field__map">
        <BoundaryLeafletMap
          key={revision}
          value={value ?? null}
          revision={revision}
          canEdit={canEdit}
          onChange={handleMapChange}
        />
      </div>

      <div className="boundary-map-field__toolbar">
        <span className="boundary-map-field__meta">
          {pointCount > 0 ? `${pointCount} точки` : 'Няма начертана граница'}
        </span>
        <div className="boundary-map-field__toolbar-actions">
          <button
            type="button"
            className="boundary-map-field__btn"
            onClick={handleCopy}
            disabled={!value}
          >
            {copied ? 'Копирано!' : 'Копирай GeoJSON'}
          </button>
          {canEdit && (
            <button
              type="button"
              className="boundary-map-field__btn"
              onClick={() => {
                setShowImport((s) => !s)
                setImportError(null)
              }}
            >
              Постави GeoJSON
            </button>
          )}
        </div>
      </div>

      {showImport && canEdit && (
        <div className="boundary-map-field__import">
          <textarea
            className="boundary-map-field__textarea"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              if (importError) setImportError(null)
            }}
            placeholder='{"type":"Polygon","coordinates":[[[23.32,42.69],...]]}'
            rows={4}
          />
          {importError && <p className="boundary-map-field__error">{importError}</p>}
          <div className="boundary-map-field__import-actions">
            <button
              type="button"
              className="boundary-map-field__btn boundary-map-field__btn--primary"
              onClick={handleApplyImport}
              disabled={!importText.trim()}
            >
              Приложи
            </button>
            <button
              type="button"
              className="boundary-map-field__btn"
              onClick={() => {
                setShowImport(false)
                setImportText('')
                setImportError(null)
              }}
            >
              Отказ
            </button>
          </div>
        </div>
      )}

      {showError && errorMessage && <p className="boundary-map-field__error">{errorMessage}</p>}
    </div>
  )
}
