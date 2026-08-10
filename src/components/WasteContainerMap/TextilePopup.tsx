'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { colors } from '@/cssVariables'
import { isCityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import { TEXTILE_MARKER_COLOR, TEXTILE_STATUS_LABELS, TextileContainerPoint } from './types'

const STATUS_COLORS: Record<string, string> = {
  full: colors.error,
  damaged: colors.warning,
  open: colors.textSecondary,
}

const FIELD_LABEL_STYLE = { color: colors.textMuted }
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
  minHeight: 64,
  fontFamily: 'inherit',
} as const

const DETAIL_ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
} as const

const DETAIL_LABEL_STYLE = {
  ...FIELD_LABEL_STYLE,
  width: 108,
  flexShrink: 0,
  paddingTop: 6,
} as const

const DETAIL_VALUE_STYLE = {
  flex: 1,
  minWidth: 0,
} as const

interface RelationOption {
  id: number
  label: string
  description?: string
}

interface EditFormState {
  number: string
  address: string
  lat: string
  lng: string
  status: string
  notes: string
  districtId: string
  companyId: string
}

function createEditFormState(container: TextileContainerPoint): EditFormState {
  return {
    number: container.number != null ? String(container.number) : '',
    address: container.address ?? '',
    lat: String(container.location[1]),
    lng: String(container.location[0]),
    status: container.status ?? '',
    notes: container.notes ?? '',
    districtId: container.district != null ? String(container.district) : '',
    companyId: container.company != null ? String(container.company) : '',
  }
}

interface TextilePopupProps {
  container: TextileContainerPoint
  onClose: () => void
  onContainerUpdated: (updated: TextileContainerPoint) => void
  onContainerDeleted: (id: number) => void
}

function SearchableRelationField({
  label,
  query,
  setQuery,
  selected,
  options,
  loading,
  error,
  placeholder,
  onSelect,
  onClear,
  dirty,
}: {
  label: string
  query: string
  setQuery: (value: string) => void
  selected: RelationOption | null
  options: RelationOption[]
  loading: boolean
  error: string | null
  placeholder: string
  onSelect: (option: RelationOption) => void
  onClear: () => void
  dirty: boolean
}) {
  return (
    <div style={{ ...DETAIL_ROW_STYLE, alignItems: 'stretch' }}>
      <div style={DETAIL_LABEL_STYLE}>{label}</div>
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
                {selected.label}
              </div>
              {selected.description && (
                <div style={{ color: colors.textMuted, fontSize: 11 }}>{selected.description}</div>
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
          placeholder={placeholder}
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
                <span>{option.label}</span>
                {option.description && (
                  <span style={{ fontSize: 11, color: colors.textMuted }}>
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={DETAIL_ROW_STYLE}>
      <div style={DETAIL_LABEL_STYLE}>{label}</div>
      <div style={DETAIL_VALUE_STYLE}>{children}</div>
    </div>
  )
}

/**
 * Editable counterpart to ContainerPopup for the textile layer — same card
 * chrome, header pills, dirty-field highlighting and inline edit flow, over the
 * textile collection's own field set (номер, фирма, район, състояние).
 */
export function TextilePopup({
  container,
  onClose,
  onContainerUpdated,
  onContainerDeleted,
}: TextilePopupProps) {
  const { user } = useAuth()
  const canEditContainer = isCityInfrastructureAdmin(user?.role)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditFormState>(() => createEditFormState(container))
  const [districtQuery, setDistrictQuery] = useState('')
  const [districtOptions, setDistrictOptions] = useState<RelationOption[]>([])
  const [districtLoading, setDistrictLoading] = useState(false)
  const [districtError, setDistrictError] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<RelationOption | null>(null)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState<RelationOption[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<RelationOption | null>(null)
  const initialForm = createEditFormState(container)

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

  const getTextAreaStyle = (field: keyof EditFormState) => ({
    ...TEXTAREA_STYLE,
    border: `1px solid ${isFieldDirty(field) ? colors.primaryDark : colors.border}`,
    background: isFieldDirty(field) ? colors.warningLight : colors.surface,
  })

  useEffect(() => {
    void Promise.resolve().then(() => {
      setForm(createEditFormState(container))
      setSaveError(null)
      setDistrictQuery('')
      setCompanyQuery('')
      setIsEditing(false)
    })
  }, [container])

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
            label: `${doc.name}`,
            description: doc.code,
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

  useEffect(() => {
    const companyId = Number(form.companyId)
    if (!Number.isFinite(companyId) || companyId <= 0) {
      void Promise.resolve().then(() => {
        setSelectedCompany(null)
      })
      return
    }
    if (selectedCompany?.id === companyId) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/textile-companies/${companyId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const doc = (await res.json()) as { id: number; name: string; phone?: string | null }
        if (!cancelled) {
          setSelectedCompany({
            id: doc.id,
            label: doc.name,
            description: doc.phone ?? undefined,
          })
        }
      } catch {
        if (!cancelled) setSelectedCompany(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [form.companyId, selectedCompany?.id])

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
            label: `${doc.name}`,
            description: doc.code,
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

  useEffect(() => {
    if (!companyQuery.trim()) {
      void Promise.resolve().then(() => {
        setCompanyOptions([])
        setCompanyError(null)
      })
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setCompanyLoading(true)
      setCompanyError(null)
      try {
        const params = new URLSearchParams({ limit: '8' })
        params.set('where[name][like]', companyQuery.trim())
        const res = await fetch(`/api/textile-companies?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as {
          docs?: Array<{ id: number; name: string; phone?: string | null }>
        }
        setCompanyOptions(
          (data.docs ?? []).map((doc) => ({
            id: doc.id,
            label: doc.name,
            description: doc.phone ?? undefined,
          }))
        )
      } catch (e) {
        if (!controller.signal.aborted) {
          setCompanyError(e instanceof Error ? e.message : 'Неуспешно търсене на фирма')
        }
      } finally {
        if (!controller.signal.aborted) setCompanyLoading(false)
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [companyQuery])

  const handleFieldChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaveLoading(true)
    setSaveError(null)

    try {
      const lat = Number(form.lat)
      const lng = Number(form.lng)
      const number = form.number.trim() ? Number(form.number) : null
      const district = form.districtId.trim() ? Number(form.districtId) : null
      const company = form.companyId.trim() ? Number(form.companyId) : null

      if (!form.address.trim()) throw new Error('Адресът е задължителен')
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Невалидни координати')
      }
      if (number != null && !Number.isFinite(number)) {
        throw new Error('Невалиден номер')
      }
      if (district != null && !Number.isFinite(district)) {
        throw new Error('Невалиден район ID')
      }
      if (company != null && !Number.isFinite(company)) {
        throw new Error('Невалидна фирма ID')
      }

      const payload = {
        number,
        address: form.address.trim(),
        location: [lng, lat],
        status: (form.status || null) as TextileContainerPoint['status'],
        notes: form.notes.trim() || null,
        district,
        company,
      }

      const res = await fetch(`/api/textile-containers/${container.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? body.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }

      const data = await res.json().catch(() => ({}))
      onContainerUpdated({
        ...container,
        number: payload.number,
        address: payload.address,
        location: payload.location as [number, number],
        status: payload.status,
        notes: payload.notes,
        district,
        // The map endpoint joins these names in; keep them in sync locally so the
        // read view and the popup header do not go stale until the next refetch.
        districtName:
          district === container.district
            ? container.districtName
            : (selectedDistrict?.label ?? null),
        districtNumber: district === container.district ? container.districtNumber : null,
        company,
        companyName:
          company === container.company ? container.companyName : (selectedCompany?.label ?? null),
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
    if (!window.confirm('Сигурни ли сте, че искате да изтриете контейнера за текстил?')) {
      return
    }

    setDeleteLoading(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/textile-containers/${container.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }

      onContainerDeleted(container.id)
      onClose()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Неуспешно изтриване')
    } finally {
      setDeleteLoading(false)
    }
  }

  const [lng, lat] = container.location
  const statusColor = container.status ? STATUS_COLORS[container.status] : undefined

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
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: colors.textPrimary }}>
            {container.number !== null ? `№ ${container.number}` : `ID ${container.id}`}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {container.status && statusColor && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: statusColor + '20',
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                }}
              >
                {TEXTILE_STATUS_LABELS[container.status] ?? container.status}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: TEXTILE_MARKER_COLOR + '20',
                color: TEXTILE_MARKER_COLOR,
              }}
            >
              За текстил
            </span>
          </div>
          {canEditContainer && !isEditing && (
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
          {canEditContainer && isEditing && (
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
                  setForm(createEditFormState(container))
                  setSaveError(null)
                  setSelectedDistrict(null)
                  setDistrictQuery('')
                  setSelectedCompany(null)
                  setCompanyQuery('')
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
          padding: '12px 12px',
          fontSize: 13,
          color: colors.textSecondary,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {/* Signals */}
        <div
          style={{
            marginTop: 2,
            marginBottom: 2,
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Link
            href={`/admin/collections/signals?where[cityObject.referenceId][equals]=${encodeURIComponent(String(container.id))}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600, color: colors.primaryDark, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Сигнали: {container.activeSignalCount} активни / {container.signalCount} общо
          </Link>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: '10px',
            borderRadius: 8,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            display: 'grid',
            gap: 5,
            fontSize: 12,
          }}
        >
          <DetailRow label="ID">{container.id}</DetailRow>
          {canEditContainer && isEditing ? (
            <>
              <DetailRow label="Номер">
                <input
                  type="number"
                  value={form.number}
                  onChange={(e) => handleFieldChange('number', e.target.value)}
                  style={getInputStyle('number')}
                />
              </DetailRow>
              <DetailRow label="Състояние">
                <select
                  value={form.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  style={getInputStyle('status')}
                >
                  <option value="">—</option>
                  {Object.entries(TEXTILE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Адрес">
                <input
                  value={form.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  style={getInputStyle('address')}
                />
              </DetailRow>
              <SearchableRelationField
                label="Фирма"
                query={companyQuery}
                setQuery={setCompanyQuery}
                selected={selectedCompany}
                options={companyOptions}
                loading={companyLoading}
                error={companyError}
                placeholder="Търси по име на фирма"
                onSelect={(option) => {
                  setSelectedCompany(option)
                  handleFieldChange('companyId', String(option.id))
                  setCompanyQuery('')
                  setCompanyOptions([])
                }}
                onClear={() => {
                  setSelectedCompany(null)
                  handleFieldChange('companyId', '')
                }}
                dirty={isFieldDirty('companyId')}
              />
              <SearchableRelationField
                label="Район"
                query={districtQuery}
                setQuery={setDistrictQuery}
                selected={selectedDistrict}
                options={districtOptions}
                loading={districtLoading}
                error={districtError}
                placeholder="Търси по име на район"
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
              <DetailRow label="Бележки">
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  style={getTextAreaStyle('notes')}
                />
              </DetailRow>
            </>
          ) : (
            <>
              <DetailRow label="Номер">{container.number ?? '—'}</DetailRow>
              <DetailRow label="Състояние">
                {container.status
                  ? (TEXTILE_STATUS_LABELS[container.status] ?? container.status)
                  : '—'}
              </DetailRow>
              <DetailRow label="Адрес">{container.address}</DetailRow>
              <DetailRow label="Фирма">{container.companyName ?? '—'}</DetailRow>
              <DetailRow label="Район">{container.districtName ?? '—'}</DetailRow>
              <DetailRow label="Координати">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </DetailRow>
              {container.notes && <DetailRow label="Бележки">{container.notes}</DetailRow>}
            </>
          )}
          <DetailRow label="Създаден">
            {new Date(container.createdAt).toLocaleString('bg-BG')}
          </DetailRow>
          <DetailRow label="Обновен">
            {new Date(container.updatedAt).toLocaleString('bg-BG')}
          </DetailRow>
        </div>
        {canEditContainer && saveError && (
          <p style={{ color: colors.error, margin: '8px 0 0' }}>{saveError}</p>
        )}
        {canEditContainer && deleteError && (
          <p style={{ color: colors.error, margin: '8px 0 0' }}>{deleteError}</p>
        )}
      </div>
    </div>
  )
}
