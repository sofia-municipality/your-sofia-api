'use client'

import React, { useEffect, useState } from 'react'
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
]

interface District {
  id: number
  name: string
}

function Chip({
  label,
  active,
  color,
  onToggle,
}: {
  label: string
  active: boolean
  color?: string
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? (color ?? '#1E40AF') : 'var(--theme-elevation-200, #D1D5DB)'}`,
        background: active ? (color ?? '#1E40AF') + '20' : 'var(--theme-elevation-0, #fff)',
        color: active ? (color ?? '#1E40AF') : 'var(--theme-text)',
        fontWeight: active ? 600 : 400,
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
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
        <span style={{ fontSize: 11, color: 'var(--theme-text)', marginLeft: 'auto' }}>
          {expanded ? '▲ Скрий' : '▼ Покажи'}
        </span>
        {hasActiveFilters && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange(EMPTY_FILTERS)
            }}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              border: '1px solid var(--theme-elevation-200, #D1D5DB)',
              borderRadius: 999,
              background: 'var(--theme-elevation-0, #fff)',
              color: 'var(--theme-text)',
              cursor: 'pointer',
            }}
          >
            Изчисти
          </button>
        )}
      </div>

      {expanded && (
        <div
          style={{
            padding: '4px 24px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Status */}
          <FilterRow label="Статус">
            {STATUSES.map(({ value, label, color }) => (
              <Chip
                key={value}
                label={label}
                active={filters.statuses.includes(value)}
                color={color}
                onToggle={() => onChange({ ...filters, statuses: toggle(filters.statuses, value) })}
              />
            ))}
          </FilterRow>

          {/* Waste type */}
          <FilterRow label="Тип">
            {WASTE_TYPES.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                active={filters.wasteTypes.includes(value)}
                onToggle={() =>
                  onChange({ ...filters, wasteTypes: toggle(filters.wasteTypes, value) })
                }
              />
            ))}
          </FilterRow>

          <FilterRow label="Обем">
            {[
              { value: '1.1', label: '1100' },
              { value: '0.12', label: '120' },
            ].map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                active={filters.volumeOptions.includes(value)}
                onToggle={() =>
                  onChange({
                    ...filters,
                    volumeOptions: filters.volumeOptions.includes(value)
                      ? filters.volumeOptions.filter((v) => v !== value)
                      : [...filters.volumeOptions, value],
                  })
                }
              />
            ))}
          </FilterRow>

          {/* District + signals toggle */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {districts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--theme-text)', fontWeight: 500 }}>
                  Район:
                </span>
                <select
                  value={filters.districtId ?? ''}
                  onChange={(e) => onChange({ ...filters, districtId: e.target.value || null })}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--theme-elevation-200, #D1D5DB)',
                    fontSize: 12,
                    background: 'var(--theme-elevation-0, #fff)',
                    color: 'var(--theme-text)',
                  }}
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
              <span style={{ fontSize: 12, color: 'var(--theme-text)' }}>
                Само с активни сигнали
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--theme-text)', fontWeight: 500, minWidth: 70 }}>
        {label}:
      </span>
      {children}
    </div>
  )
}
