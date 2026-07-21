'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { colors } from '@/cssVariables'
import { canManageFountains } from '@/access/cityInfrastructureAdmin'
import { Fountain, Lookups } from './types'

const INPUT_STYLE = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  fontSize: 12,
  background: colors.surface,
  color: colors.textPrimary,
} as const

const TEXTAREA_STYLE = {
  ...INPUT_STYLE,
  resize: 'vertical' as const,
  minHeight: 56,
  fontFamily: 'inherit',
} as const

const DETAIL_ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
} as const

const DETAIL_LABEL_STYLE = {
  color: colors.textMuted,
  width: 116,
  flexShrink: 0,
  paddingTop: 6,
} as const

const DETAIL_VALUE_STYLE = {
  flex: 1,
  minWidth: 0,
} as const

interface DistrictOption {
  id: number
  districtNumber: number
  name: string
  code: string
}

interface EditFormState {
  address: string
  lat: string
  lng: string
  isActive: string // 'true' | 'false' | '' (unknown)
  statusId: string
  sourceId: string
  activationTypeId: string
  ownerId: string
  districtId: string
  protectionStatus: string
  externalLink: string
}

function createEditFormState(f: Fountain): EditFormState {
  return {
    address: f.address ?? '',
    lat: String(f.location[1]),
    lng: String(f.location[0]),
    isActive: f.isActive === true ? 'true' : f.isActive === false ? 'false' : '',
    statusId: f.status != null ? String(f.status) : '',
    sourceId: f.source != null ? String(f.source) : '',
    activationTypeId: f.activationType != null ? String(f.activationType) : '',
    ownerId: f.owner != null ? String(f.owner) : '',
    districtId: f.district != null ? String(f.district) : '',
    protectionStatus: f.protectionStatus ?? '',
    externalLink: f.externalLink ?? '',
  }
}

function activeLabel(isActive: boolean | null): { text: string; color: string } {
  if (isActive === true) return { text: 'Действаща', color: colors.success }
  if (isActive === false) return { text: 'Недействаща', color: colors.error }
  return { text: 'Няма данни', color: colors.textMuted }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={DETAIL_ROW_STYLE}>
      <div style={DETAIL_LABEL_STYLE}>{label}</div>
      <div style={DETAIL_VALUE_STYLE}>{children}</div>
    </div>
  )
}

function DistrictField({
  query,
  setQuery,
  selected,
  options,
  loading,
  error,
  onSelect,
  onClear,
  dirty,
}: {
  query: string
  setQuery: (value: string) => void
  selected: DistrictOption | null
  options: DistrictOption[]
  loading: boolean
  error: string | null
  onSelect: (option: DistrictOption) => void
  onClear: () => void
  dirty: boolean
}) {
  return (
    <div style={{ ...DETAIL_ROW_STYLE, alignItems: 'stretch' }}>
      <div style={DETAIL_LABEL_STYLE}>Район</div>
      <div style={{ ...DETAIL_VALUE_STYLE, display: 'grid', gap: 6 }}>
        {selected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${dirty ? colors.primaryDark : colors.border}`,
              background: dirty ? colors.warningLight : colors.surface,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selected.name}
              </div>
              {selected.code && (
                <div style={{ color: colors.textMuted, fontSize: 11 }}>{selected.code}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClear}
              style={{
                border: 'none',
                background: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Изчисти
            </button>
          </div>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Търси по име на район"
          style={{
            ...INPUT_STYLE,
            border: `1px solid ${dirty ? colors.primaryDark : colors.border}`,
            background: dirty ? colors.warningLight : colors.surface,
          }}
        />
        {loading && <div style={{ fontSize: 11, color: colors.textMuted }}>Търси…</div>}
        {error && <div style={{ fontSize: 11, color: colors.error }}>{error}</div>}
        {!loading && options.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 4,
              maxHeight: 132,
              overflowY: 'auto',
              padding: 4,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
            }}
          >
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  display: 'grid',
                  gap: 2,
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: colors.surface2,
                  color: colors.textPrimary,
                  cursor: 'pointer',
                }}
              >
                <span>{option.name}</span>
                {option.code && (
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{option.code}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FountainPopupProps {
  fountain: Fountain
  lookups: Lookups
  onClose: () => void
  onFountainUpdated: (updated: Fountain) => void
  onFountainDeleted: (id: number) => void
}

export function FountainPopup({
  fountain,
  lookups,
  onClose,
  onFountainUpdated,
  onFountainDeleted,
}: FountainPopupProps) {
  const { user } = useAuth()
  const canEdit = canManageFountains(user?.role)
  const active = activeLabel(fountain.isActive)

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditFormState>(() => createEditFormState(fountain))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [districtQuery, setDistrictQuery] = useState('')
  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([])
  const [districtLoading, setDistrictLoading] = useState(false)
  const [districtError, setDistrictError] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictOption | null>(null)

  const initialForm = createEditFormState(fountain)
  const isFieldDirty = <K extends keyof EditFormState>(field: K) =>
    form[field] !== initialForm[field]
  const hasDirtyChanges = (Object.keys(initialForm) as Array<keyof EditFormState>).some((field) =>
    isFieldDirty(field)
  )

  const getInputStyle = (field: keyof EditFormState) => ({
    ...INPUT_STYLE,
    border: `1px solid ${isFieldDirty(field) ? colors.primaryDark : colors.border}`,
    background: isFieldDirty(field) ? colors.warningLight : colors.surface,
  })

  // Reset the form whenever a different fountain is selected.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setForm(createEditFormState(fountain))
      setSaveError(null)
      setDeleteError(null)
      setDistrictQuery('')
      setIsEditing(false)
    })
  }, [fountain])

  // Resolve the currently-selected district (id → number/name/code) for display.
  useEffect(() => {
    const districtId = Number(form.districtId)
    if (!Number.isFinite(districtId) || districtId <= 0) {
      void Promise.resolve().then(() => {
        setSelectedDistrict(null)
      })
      return
    }
    if (selectedDistrict?.id === districtId) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/city-districts/${districtId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const doc = (await res.json()) as {
          id: number
          name: string
          districtId: number
          code: string
        }
        if (!cancelled) {
          setSelectedDistrict({
            id: doc.id,
            districtNumber: doc.districtId,
            name: doc.name,
            code: doc.code,
          })
        }
      } catch {
        if (!cancelled) setSelectedDistrict(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [form.districtId, selectedDistrict?.id])

  // Search districts by name (debounced).
  useEffect(() => {
    if (!districtQuery.trim()) {
      void Promise.resolve().then(() => {
        setDistrictOptions([])
        setDistrictError(null)
      })
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setDistrictLoading(true)
      setDistrictError(null)
      try {
        const params = new URLSearchParams({ limit: '8' })
        params.set('where[name][like]', districtQuery.trim())
        const res = await fetch(`/api/city-districts?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as {
          docs?: Array<{ id: number; name: string; districtId: number; code: string }>
        }
        setDistrictOptions(
          (data.docs ?? []).map((doc) => ({
            id: doc.id,
            districtNumber: doc.districtId,
            name: doc.name,
            code: doc.code,
          }))
        )
      } catch (e) {
        if (!controller.signal.aborted) {
          setDistrictError(e instanceof Error ? e.message : 'Неуспешно търсене на район')
        }
      } finally {
        if (!controller.signal.aborted) setDistrictLoading(false)
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [districtQuery])

  const handleFieldChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const nameOf = (options: Lookups['sources'], id: string): string | null => {
    if (!id) return null
    const found = options.find((o) => String(o.id) === id)
    return found?.name ?? null
  }

  const handleSave = async () => {
    setSaveLoading(true)
    setSaveError(null)
    try {
      const lat = Number(form.lat)
      const lng = Number(form.lng)
      if (!form.address.trim()) throw new Error('Адресът е задължителен')
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Невалидни координати')

      const statusId = form.statusId ? Number(form.statusId) : null
      const sourceId = form.sourceId ? Number(form.sourceId) : null
      const activationTypeId = form.activationTypeId ? Number(form.activationTypeId) : null
      const ownerId = form.ownerId ? Number(form.ownerId) : null
      const districtId = form.districtId ? Number(form.districtId) : null
      const isActive = form.isActive === 'true' ? true : form.isActive === 'false' ? false : null

      const payload = {
        address: form.address.trim(),
        location: [lng, lat],
        isActive,
        status: statusId,
        source: sourceId,
        activationType: activationTypeId,
        owner: ownerId,
        district: districtId,
        protectionStatus: form.protectionStatus.trim() || null,
        externalLink: form.externalLink.trim() || null,
      }

      const res = await fetch(`/api/drinking-fountains/${fountain.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? body.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }

      const data = await res.json().catch(() => ({}))
      const districtChanged = form.districtId !== initialForm.districtId

      onFountainUpdated({
        ...fountain,
        address: payload.address,
        location: [lng, lat],
        isActive,
        status: statusId,
        statusName: nameOf(lookups.statuses, form.statusId),
        source: sourceId,
        sourceName: nameOf(lookups.sources, form.sourceId),
        activationType: activationTypeId,
        activationName: nameOf(lookups.activationTypes, form.activationTypeId),
        owner: ownerId,
        ownerName: nameOf(lookups.owners, form.ownerId),
        district: districtId,
        districtNumber: districtChanged
          ? (selectedDistrict?.districtNumber ?? null)
          : fountain.districtNumber,
        districtName: districtChanged ? (selectedDistrict?.name ?? null) : fountain.districtName,
        protectionStatus: payload.protectionStatus,
        externalLink: payload.externalLink,
        updatedAt: data.doc?.updatedAt ?? data.updatedAt ?? new Date().toISOString(),
      })
      setIsEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Неуспешно записване')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете чешмата?')) return

    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/drinking-fountains/${fountain.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      onFountainDeleted(fountain.id)
      onClose()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Неуспешно изтриване')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 420,
        maxHeight: 'calc(100% - 32px)',
        display: 'flex',
        flexDirection: 'column',
        background: colors.surface,
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        zIndex: 1000,
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${colors.surface2}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textPrimary }}>
            {fountain.address}
          </div>
          {fountain.publicNumber && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: colors.textMuted,
                fontFamily: 'monospace',
              }}
            >
              {fountain.publicNumber}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: active.color + '20',
                color: active.color,
                border: `1px solid ${active.color}40`,
              }}
            >
              {active.text}
            </span>
            {fountain.statusName && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: colors.surface2,
                  color: colors.textSecondary,
                }}
              >
                {fountain.statusName}
              </span>
            )}
          </div>
          {canEdit && !isEditing && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: colors.primaryDark,
                  color: colors.surface,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Редакция
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: deleteLoading ? 'default' : 'pointer',
                  background: colors.error,
                  color: colors.surface,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {deleteLoading ? 'Изтрива се…' : 'Изтрий'}
              </button>
            </div>
          )}
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, flexShrink: 0 }}
        >
          {canEdit && isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={saveLoading || !hasDirtyChanges}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: saveLoading || !hasDirtyChanges ? 'default' : 'pointer',
                  background:
                    saveLoading || !hasDirtyChanges ? colors.textMuted : colors.primaryDark,
                  color: colors.surface,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {saveLoading ? 'Записва…' : 'Запази'}
              </button>
              <button
                onClick={() => {
                  setForm(createEditFormState(fountain))
                  setSaveError(null)
                  setDistrictQuery('')
                  setIsEditing(false)
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: colors.surface2,
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Отказ
              </button>
            </>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textMuted,
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '12px',
          fontSize: 13,
          color: colors.textSecondary,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {/* Signals */}
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {fountain.publicNumber ? (
            <Link
              href={`/admin/collections/signals?where[cityObject.referenceId][equals]=${encodeURIComponent(fountain.publicNumber)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600, color: colors.primaryDark, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Сигнали: {fountain.activeSignalCount} активни / {fountain.signalCount} общо
            </Link>
          ) : (
            <span style={{ fontWeight: 600, color: colors.textMuted }}>
              Сигнали: {fountain.activeSignalCount} активни / {fountain.signalCount} общо
            </span>
          )}
        </div>

        <div
          style={{
            padding: '10px',
            borderRadius: 8,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            display: 'grid',
            gap: 5,
            fontSize: 12,
          }}
        >
          <DetailRow label="ID">{fountain.id}</DetailRow>
          {fountain.publicNumber && (
            <DetailRow label="Идентификатор">{fountain.publicNumber}</DetailRow>
          )}

          {canEdit && isEditing ? (
            <>
              <DetailRow label="Адрес">
                <input
                  value={form.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  style={getInputStyle('address')}
                />
              </DetailRow>
              <DetailRow label="Действаща">
                <select
                  value={form.isActive}
                  onChange={(e) => handleFieldChange('isActive', e.target.value)}
                  style={getInputStyle('isActive')}
                >
                  <option value="">Няма данни</option>
                  <option value="true">Действаща</option>
                  <option value="false">Недействаща</option>
                </select>
              </DetailRow>
              <DetailRow label="Състояние">
                <select
                  value={form.statusId}
                  onChange={(e) => handleFieldChange('statusId', e.target.value)}
                  style={getInputStyle('statusId')}
                >
                  <option value="">—</option>
                  {lookups.statuses.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Произход">
                <select
                  value={form.sourceId}
                  onChange={(e) => handleFieldChange('sourceId', e.target.value)}
                  style={getInputStyle('sourceId')}
                >
                  <option value="">—</option>
                  {lookups.sources.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Активиране">
                <select
                  value={form.activationTypeId}
                  onChange={(e) => handleFieldChange('activationTypeId', e.target.value)}
                  style={getInputStyle('activationTypeId')}
                >
                  <option value="">—</option>
                  {lookups.activationTypes.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Собственик">
                <select
                  value={form.ownerId}
                  onChange={(e) => handleFieldChange('ownerId', e.target.value)}
                  style={getInputStyle('ownerId')}
                >
                  <option value="">—</option>
                  {lookups.owners.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DistrictField
                query={districtQuery}
                setQuery={setDistrictQuery}
                selected={selectedDistrict}
                options={districtOptions}
                loading={districtLoading}
                error={districtError}
                onSelect={(option) => {
                  setSelectedDistrict(option)
                  handleFieldChange('districtId', String(option.id))
                  setDistrictQuery('')
                  setDistrictOptions([])
                }}
                onClear={() => {
                  setSelectedDistrict(null)
                  handleFieldChange('districtId', '')
                }}
                dirty={isFieldDirty('districtId')}
              />
              <DetailRow label="Координати">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input
                    type="number"
                    step="0.000001"
                    value={form.lat}
                    onChange={(e) => handleFieldChange('lat', e.target.value)}
                    style={getInputStyle('lat')}
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={form.lng}
                    onChange={(e) => handleFieldChange('lng', e.target.value)}
                    style={getInputStyle('lng')}
                  />
                </div>
              </DetailRow>
              <DetailRow label="Статут на защита">
                <textarea
                  value={form.protectionStatus}
                  onChange={(e) => handleFieldChange('protectionStatus', e.target.value)}
                  style={{
                    ...TEXTAREA_STYLE,
                    border: `1px solid ${isFieldDirty('protectionStatus') ? colors.primaryDark : colors.border}`,
                    background: isFieldDirty('protectionStatus')
                      ? colors.warningLight
                      : colors.surface,
                  }}
                />
              </DetailRow>
              <DetailRow label="Външна връзка">
                <input
                  value={form.externalLink}
                  onChange={(e) => handleFieldChange('externalLink', e.target.value)}
                  style={getInputStyle('externalLink')}
                />
              </DetailRow>
            </>
          ) : (
            <>
              <DetailRow label="Район">
                {fountain.districtNumber != null ? `${fountain.districtName ?? ''}` : '—'}
              </DetailRow>
              <DetailRow label="Произход">{fountain.sourceName ?? '—'}</DetailRow>
              <DetailRow label="Състояние">{fountain.statusName ?? '—'}</DetailRow>
              <DetailRow label="Активиране">{fountain.activationName ?? '—'}</DetailRow>
              <DetailRow label="Собственик">{fountain.ownerName ?? '—'}</DetailRow>
              {fountain.protectionStatus && (
                <DetailRow label="Статут на защита">{fountain.protectionStatus}</DetailRow>
              )}
              {fountain.externalLink && (
                <DetailRow label="Връзка">
                  <a
                    href={fountain.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: colors.primaryDark, wordBreak: 'break-all' }}
                  >
                    {fountain.externalLink}
                  </a>
                </DetailRow>
              )}
              <DetailRow label="Координати">
                {fountain.location[1].toFixed(6)}, {fountain.location[0].toFixed(6)}
              </DetailRow>
            </>
          )}

          <DetailRow label="Създадена">
            {new Date(fountain.createdAt).toLocaleString('bg-BG')}
          </DetailRow>
          <DetailRow label="Обновена">
            {new Date(fountain.updatedAt).toLocaleString('bg-BG')}
          </DetailRow>
        </div>

        {canEdit && !isEditing && (
          <div style={{ marginTop: 10 }}>
            <Link
              href={`/admin/collections/drinking-fountains/${fountain.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: colors.primaryDark, textDecoration: 'none' }}
            >
              Отвори в администрацията →
            </Link>
          </div>
        )}

        {saveError && <p style={{ color: colors.error, margin: '8px 0 0' }}>{saveError}</p>}
        {deleteError && <p style={{ color: colors.error, margin: '8px 0 0' }}>{deleteError}</p>}
      </div>
    </div>
  )
}
