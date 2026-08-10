'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FilterState, EMPTY_FILTERS } from './types'

const STATUSES = [
  { value: 'uncollected', label: 'Непочистен', color: '#F97316' },
  { value: 'active', label: 'Активен', color: '#22C55E' },
  { value: 'full', label: 'Пълен', color: '#EF4444' },
  { value: 'maintenance', label: 'Поддръжка', color: '#F97316' },
  { value: 'inactive', label: 'Неактивен', color: '#9CA3AF' },
  { value: 'pending', label: 'Изчакващ', color: '#6B7280' },
]

const WASTE_TYPES = [
  { value: 'general', label: 'Общи' },
  { value: 'recyclables', label: 'Рециклируеми' },
  { value: 'organic', label: 'Органични' },
  { value: 'glass', label: 'Стъкло' },
  { value: 'paper', label: 'Хартия' },
  { value: 'plastic', label: 'Пластмаса' },
  { value: 'metal', label: 'Метал' },
  { value: 'trashCan', label: 'Кош' },
  { value: 'textile', label: 'За текстил' },
]

const VOLUME_OPTIONS = [
  { value: '0.12', label: '120' },
  { value: '1.1', label: '1100' },
  { value: '2.25', label: 'NORD 2250' },
  { value: '3', label: 'NORD 3000' },
]

interface District {
  id: number
  name: string
}

interface Option {
  value: string
  label: string
  color?: string
}

const CONTROL_STYLE: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-200, #D1D5DB)',
  fontSize: 12,
  background: 'var(--theme-elevation-0, #fff)',
  color: 'var(--theme-text)',
  cursor: 'pointer',
}

/** Compact dropdown that lets the user tick multiple options. */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const summary = selected.length === 0 ? 'Всички' : `${selected.length} избрани`

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...CONTROL_STYLE,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: selected.length > 0 ? 600 : 400,
          borderColor: selected.length > 0 ? '#1E40AF' : 'var(--theme-elevation-200, #D1D5DB)',
          maxWidth: 240,
        }}
      >
        <span style={{ color: 'var(--theme-text)', fontWeight: 500 }}>{label}:</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selected.length > 0 ? '#1E40AF' : 'var(--theme-elevation-500, #6B7280)',
          }}
        >
          {summary}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--theme-text)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1200,
            minWidth: 200,
            maxWidth: 320,
            maxHeight: 260,
            overflowY: 'auto',
            padding: 4,
            borderRadius: 8,
            border: '1px solid var(--theme-elevation-200, #D1D5DB)',
            background: 'var(--theme-elevation-0, #fff)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.16)',
          }}
        >
          {options.length === 0 && (
            <div
              style={{
                padding: '6px 8px',
                fontSize: 12,
                color: 'var(--theme-elevation-500, #6B7280)',
              }}
            >
              Няма опции
            </div>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--theme-text)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                style={{ cursor: 'pointer' }}
              />
              {o.color && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: o.color,
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

interface MapFiltersProps {
  filters: FilterState
  onChange: (f: FilterState) => void
}

export function MapFilters({ filters, onChange }: MapFiltersProps) {
  const [districts, setDistricts] = useState<District[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/city-districts?limit=30&sort=name')
      .then((r) => r.json())
      .then((data) => setDistricts(data.docs ?? []))
      .catch(() => {})
  }, [])

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.wasteTypes.length > 0 ||
    filters.districtId !== null ||
    filters.volumeOptions.length > 0 ||
    filters.hasActiveSignals

  return (
    <div
      style={{
        borderBottom: '1px solid var(--theme-elevation-200, #E5E7EB)',
        background: 'var(--theme-bg)',
        flexShrink: 0,
      }}
    >
      {/* Toggle bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 24px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>
          Филтри {hasActiveFilters && '●'}
        </span>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange(EMPTY_FILTERS)
            }}
            disabled={!hasActiveFilters}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              border: '1px solid var(--theme-elevation-200, #D1D5DB)',
              borderRadius: 999,
              background: 'var(--theme-elevation-0, #fff)',
              color: 'var(--theme-text)',
              cursor: hasActiveFilters ? 'pointer' : 'default',
              visibility: hasActiveFilters ? 'visible' : 'hidden',
            }}
          >
            Изчисти
          </button>

          <span style={{ fontSize: 11, color: 'var(--theme-text)' }}>
            {expanded ? '▲ Скрий' : '▼ Покажи'}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: '4px 24px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MultiSelect
            label="Статус"
            options={STATUSES}
            selected={filters.statuses}
            onChange={(next) => onChange({ ...filters, statuses: next })}
          />
          <MultiSelect
            label="Тип"
            options={WASTE_TYPES}
            selected={filters.wasteTypes}
            onChange={(next) => onChange({ ...filters, wasteTypes: next })}
          />
          <MultiSelect
            label="Обем"
            options={VOLUME_OPTIONS}
            selected={filters.volumeOptions}
            onChange={(next) => onChange({ ...filters, volumeOptions: next })}
          />

          {districts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--theme-text)', fontWeight: 500 }}>
                Район:
              </span>
              <select
                value={filters.districtId ?? ''}
                onChange={(e) => onChange({ ...filters, districtId: e.target.value || null })}
                style={CONTROL_STYLE}
              >
                <option value="">Всички</option>
                {districts.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters.hasActiveSignals}
              onChange={(e) => onChange({ ...filters, hasActiveSignals: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: 'var(--theme-text)' }}>Само с активни сигнали</span>
          </label>
        </div>
      )}
    </div>
  )
}
