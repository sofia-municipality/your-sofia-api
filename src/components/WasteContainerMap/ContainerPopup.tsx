'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { colors } from '@/cssVariables'
import { isCityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import { ContainerWithSignals } from './types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  full: 'Пълен',
  maintenance: 'Поддръжка',
  inactive: 'Неактивен',
  pending: 'Изчакващ',
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.success,
  full: colors.error,
  maintenance: colors.warning,
  inactive: colors.textMuted,
  pending: colors.textSecondary,
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  general: 'Общи',
  recyclables: 'Рециклируеми',
  organic: 'Органични',
  glass: 'Стъкло',
  paper: 'Хартия',
  plastic: 'Пластмаса',
  metal: 'Метал',
  trashCan: 'Кош',
}

const CAPACITY_LABELS: Record<string, string> = {
  tiny: 'Много малък',
  small: 'Малък',
  standard: 'Стандартен',
  big: 'Голям',
  industrial: 'Промишлен',
}

const STATE_LABELS: Record<string, string> = {
  full: 'Пълен',
  dirty: 'Замърсен',
  damaged: 'Повреден',
  leaves: 'Листа',
  maintenance: 'Поддръжка',
  bagged: 'Боклук в торби',
  fallen: 'Паднал',
  bulkyWaste: 'Едрогабаритен боклук',
}

const SOURCE_LABELS: Record<string, string> = {
  community: 'Гражданин',
  official: 'Официални данни',
  third_party: 'Трета страна',
}

const DAY_LABELS: Record<string, string> = {
  '1': 'Пон',
  '2': 'Вт',
  '3': 'Ср',
  '4': 'Чет',
  '5': 'Пет',
  '6': 'Съб',
  '7': 'Нед',
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
  publicNumber: string
  lat: string
  lng: string
  capacitySize: ContainerWithSignals['capacitySize']
  capacityVolume: string
  wasteType: ContainerWithSignals['wasteType']
  status: ContainerWithSignals['status']
  address: string
  notes: string
  servicedBy: string
  lastCleaned: string
  binCount: string
  districtId: string
  source: string
  stateValues: string
  collectionDays: string
  collectionTimesPerDay: string
}

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function createEditFormState(container: ContainerWithSignals): EditFormState {
  return {
    publicNumber: container.publicNumber,
    lat: String(container.location[1]),
    lng: String(container.location[0]),
    capacitySize: container.capacitySize,
    capacityVolume: String(container.capacityVolume),
    wasteType: container.wasteType,
    status: container.status,
    address: container.address ?? '',
    notes: container.notes ?? '',
    servicedBy: container.servicedBy ?? '',
    lastCleaned: toDateTimeLocalValue(container.lastCleaned),
    binCount: container.binCount != null ? String(container.binCount) : '',
    districtId: container.districtId != null ? String(container.districtId) : '',
    source: container.source ?? '',
    stateValues: (container.state ?? []).slice().sort().join(','),
    collectionDays: (container.collectionDaysOfWeek ?? []).slice().sort().join(','),
    collectionTimesPerDay:
      container.collectionTimesPerDay != null ? String(container.collectionTimesPerDay) : '',
  }
}

interface ContainerPopupProps {
  container: ContainerWithSignals
  onClose: () => void
  onContainerUpdated: (updated: ContainerWithSignals) => void
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

export function ContainerPopup({ container, onClose, onContainerUpdated }: ContainerPopupProps) {
  const { user } = useAuth()
  const canEditContainer = isCityInfrastructureAdmin(user?.role)

  const [cleaning, setCleaning] = useState(false)
  const [cleanNotes, setCleanNotes] = useState('')
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [cleanLoading, setCleanLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditFormState>(() => createEditFormState(container))
  const [districtQuery, setDistrictQuery] = useState('')
  const [districtOptions, setDistrictOptions] = useState<RelationOption[]>([])
  const [districtLoading, setDistrictLoading] = useState(false)
  const [districtError, setDistrictError] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<RelationOption | null>(null)
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
            label: `${doc.districtId} · ${doc.name}`,
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
            label: `${doc.districtId} · ${doc.name}`,
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

  const handleFieldChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaveLoading(true)
    setSaveError(null)

    try {
      const capacityVolume = Number(form.capacityVolume)
      const lat = Number(form.lat)
      const lng = Number(form.lng)
      const binCount = form.binCount.trim() ? Number(form.binCount) : null
      const district = form.districtId.trim() ? Number(form.districtId) : null

      if (!form.publicNumber.trim()) throw new Error('Публичният номер е задължителен')
      if (!Number.isFinite(capacityVolume) || capacityVolume < 0) {
        throw new Error('Невалиден обем')
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Невалидни координати')
      }
      if (binCount != null && (!Number.isFinite(binCount) || binCount < 1)) {
        throw new Error('Невалиден брой съдове')
      }
      if (district != null && !Number.isFinite(district)) {
        throw new Error('Невалиден район ID')
      }

      const collectionTimesPerDay = form.collectionTimesPerDay.trim()
        ? Number(form.collectionTimesPerDay)
        : null

      const payload = {
        publicNumber: form.publicNumber.trim(),
        location: [lng, lat],
        capacitySize: form.capacitySize,
        capacityVolume,
        binCount,
        servicedBy: form.servicedBy.trim() || null,
        wasteType: form.wasteType,
        status: form.status,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        lastCleaned: form.lastCleaned ? new Date(form.lastCleaned).toISOString() : null,
        district,
        source: form.source.trim() || null,
        state: form.stateValues.split(',').filter(Boolean),
        collectionDaysOfWeek: form.collectionDays.split(',').filter(Boolean),
        collectionTimesPerDay,
      }

      const res = await fetch(`/api/waste-containers/${container.id}`, {
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
        publicNumber: payload.publicNumber,
        location: payload.location as [number, number],
        capacitySize: payload.capacitySize,
        capacityVolume: payload.capacityVolume,
        wasteType: payload.wasteType,
        status: payload.status,
        address: payload.address,
        notes: payload.notes,
        servicedBy: payload.servicedBy,
        lastCleaned: payload.lastCleaned,
        binCount: payload.binCount,
        districtId: district,
        source: payload.source,
        state: payload.state,
        collectionDaysOfWeek: payload.collectionDaysOfWeek,
        collectionTimesPerDay: payload.collectionTimesPerDay,
        updatedAt: data.doc?.updatedAt ?? data.updatedAt ?? new Date().toISOString(),
      })
      setIsEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Неуспешно записване')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleClean = async () => {
    setCleanLoading(true)
    setCleanError(null)
    try {
      const body = new FormData()
      if (cleanNotes) body.append('notes', cleanNotes)
      const res = await fetch(`/api/waste-containers/${container.id}/clean`, {
        method: 'POST',
        body,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      onContainerUpdated({
        ...container,
        status: 'active',
        lastCleaned: data.container?.lastCleaned ?? new Date().toISOString(),
        activeSignalCount: 0,
      })
      setCleaning(false)
      setCleanNotes('')
    } catch (e) {
      setCleanError(e instanceof Error ? e.message : 'Неуспешно почистване')
    } finally {
      setCleanLoading(false)
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
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: colors.textPrimary }}>
            {container.publicNumber}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: STATUS_COLORS[container.status] + '20',
                color: STATUS_COLORS[container.status],
                border: `1px solid ${STATUS_COLORS[container.status]}40`,
              }}
            >
              {STATUS_LABELS[container.status] ?? container.status}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: colors.surface2,
                color: colors.textSecondary,
              }}
            >
              {WASTE_TYPE_LABELS[container.wasteType] ?? container.wasteType}
            </span>
          </div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, flexShrink: 0 }}
        >
          {canEditContainer && !isEditing && (
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
          )}
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
            href={`/admin/collections/signals?where[cityObject.referenceId][equals]=${encodeURIComponent(container.publicNumber)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600, color: colors.primaryDark, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Сигнали: {container.activeSignalCount} активни / {container.signalCount} общо
          </Link>
          {canEditContainer && !cleaning && (
            <button
              onClick={() => setCleaning(true)}
              disabled={container.signalCount === 0}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: container.signalCount > 0 ? colors.success : colors.textMuted,
                color: colors.surface,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: container.signalCount > 0 ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              Почисти
            </button>
          )}
        </div>

        {cleaning && (
          <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              placeholder="Бележки (по желание)"
              value={cleanNotes}
              onChange={(e) => setCleanNotes(e.target.value)}
              rows={2}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                fontSize: 13,
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
            {cleanError && (
              <p style={{ color: colors.error, fontSize: 12, margin: 0 }}>{cleanError}</p>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleClean}
                disabled={cleanLoading}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 6,
                  background: cleanLoading ? colors.textMuted : colors.success,
                  color: colors.surface,
                  fontSize: 13,
                  border: 'none',
                  cursor: cleanLoading ? 'default' : 'pointer',
                }}
              >
                {cleanLoading ? 'Изпраща се…' : 'Потвърди'}
              </button>
              <button
                onClick={() => {
                  setCleaning(false)
                  setCleanNotes('')
                  setCleanError(null)
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  background: colors.surface2,
                  color: colors.textSecondary,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Отказ
              </button>
            </div>
          </div>
        )}

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
              <DetailRow label="Публичен номер">
                <input
                  value={form.publicNumber}
                  onChange={(e) => handleFieldChange('publicNumber', e.target.value)}
                  style={getInputStyle('publicNumber')}
                />
              </DetailRow>
              <DetailRow label="Статус">
                <select
                  value={form.status}
                  onChange={(e) =>
                    handleFieldChange('status', e.target.value as ContainerWithSignals['status'])
                  }
                  style={getInputStyle('status')}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Вид отпадък">
                <select
                  value={form.wasteType}
                  onChange={(e) =>
                    handleFieldChange(
                      'wasteType',
                      e.target.value as ContainerWithSignals['wasteType']
                    )
                  }
                  style={getInputStyle('wasteType')}
                >
                  {Object.entries(WASTE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Размер">
                <select
                  value={form.capacitySize}
                  onChange={(e) =>
                    handleFieldChange(
                      'capacitySize',
                      e.target.value as ContainerWithSignals['capacitySize']
                    )
                  }
                  style={getInputStyle('capacitySize')}
                >
                  {Object.entries(CAPACITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Обем (m³)">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.capacityVolume}
                  onChange={(e) => handleFieldChange('capacityVolume', e.target.value)}
                  style={getInputStyle('capacityVolume')}
                />
              </DetailRow>
              <DetailRow label="Адрес">
                <input
                  value={form.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  style={getInputStyle('address')}
                />
              </DetailRow>
              <DetailRow label="Обслужва">
                <input
                  value={form.servicedBy}
                  onChange={(e) => handleFieldChange('servicedBy', e.target.value)}
                  style={getInputStyle('servicedBy')}
                />
              </DetailRow>
              <DetailRow label="Последно почистен">
                <input
                  type="datetime-local"
                  value={form.lastCleaned}
                  onChange={(e) => handleFieldChange('lastCleaned', e.target.value)}
                  style={getInputStyle('lastCleaned')}
                />
              </DetailRow>
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
              <DetailRow label="Брой съдове">
                <input
                  type="number"
                  min="1"
                  value={form.binCount}
                  onChange={(e) => handleFieldChange('binCount', e.target.value)}
                  style={getInputStyle('binCount')}
                />
              </DetailRow>
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
              <DetailRow label="Произход">
                <select
                  value={form.source}
                  onChange={(e) => handleFieldChange('source', e.target.value)}
                  style={getInputStyle('source')}
                >
                  <option value="">—</option>
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </DetailRow>
              <DetailRow label="Състояние">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Object.entries(STATE_LABELS).map(([value, label]) => {
                    const checked = form.stateValues.split(',').filter(Boolean).includes(value)
                    return (
                      <label
                        key={value}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = form.stateValues.split(',').filter(Boolean)
                            const next = e.target.checked
                              ? [...current, value]
                              : current.filter((v) => v !== value)
                            handleFieldChange('stateValues', next.slice().sort().join(','))
                          }}
                        />
                        <span style={{ fontSize: 11 }}>{label}</span>
                      </label>
                    )
                  })}
                </div>
              </DetailRow>
              <DetailRow label="Дни за събиране">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Object.entries(DAY_LABELS).map(([value, label]) => {
                    const checked = form.collectionDays.split(',').filter(Boolean).includes(value)
                    return (
                      <label
                        key={value}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = form.collectionDays.split(',').filter(Boolean)
                            const next = e.target.checked
                              ? [...current, value]
                              : current.filter((v) => v !== value)
                            handleFieldChange('collectionDays', next.slice().sort().join(','))
                          }}
                        />
                        <span style={{ fontSize: 11 }}>{label}</span>
                      </label>
                    )
                  })}
                </div>
              </DetailRow>
              <DetailRow label="Събирания/ден">
                <input
                  type="number"
                  min="1"
                  value={form.collectionTimesPerDay}
                  onChange={(e) => handleFieldChange('collectionTimesPerDay', e.target.value)}
                  style={getInputStyle('collectionTimesPerDay')}
                />
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
              <DetailRow label="Статус">
                {STATUS_LABELS[container.status] ?? container.status}
              </DetailRow>
              <DetailRow label="Вид отпадък">
                {WASTE_TYPE_LABELS[container.wasteType] ?? container.wasteType}
              </DetailRow>
              <DetailRow label="Размер">
                {CAPACITY_LABELS[container.capacitySize] ?? container.capacitySize}
              </DetailRow>
              <DetailRow label="Обем">{container.capacityVolume} m³</DetailRow>
              {container.address && <DetailRow label="Адрес">{container.address}</DetailRow>}
              {container.servicedBy && (
                <DetailRow label="Обслужва">{container.servicedBy}</DetailRow>
              )}
              <DetailRow label="Последно почистен">
                {container.lastCleaned && new Date(container.lastCleaned).toLocaleString('bg-BG')}
              </DetailRow>
              <DetailRow label="Координати">
                {container.location[1].toFixed(6)}, {container.location[0].toFixed(6)}
              </DetailRow>
              <DetailRow label="Брой съдове">{container.binCount}</DetailRow>
              <DetailRow label="Район ID">{container.districtId}</DetailRow>

              <DetailRow label="Произход">
                {SOURCE_LABELS[container.source ?? ''] ?? container.source ?? '—'}
              </DetailRow>
              <DetailRow label="Състояние">
                {container.state?.map((s) => STATE_LABELS[s] ?? s).join(', ') || '—'}
              </DetailRow>
              <DetailRow label="Дни за събиране">
                {container.collectionDaysOfWeek?.map((d) => DAY_LABELS[d] ?? d).join(', ') || '—'}
              </DetailRow>
              <DetailRow label="Събирания/ден">
                {container.collectionTimesPerDay != null
                  ? `${container.collectionTimesPerDay}×`
                  : '—'}
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
      </div>

      {/* Actions */}
      <div
        style={{
          padding: '8px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          borderTop: `1px solid ${colors.surface2}`,
        }}
      ></div>
    </div>
  )
}
