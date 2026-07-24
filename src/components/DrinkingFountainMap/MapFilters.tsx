'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACTIVE_STATE_LABELS,
  ActiveState,
  EMPTY_FILTERS,
  FilterState,
  Fountain,
  buildFilterOptions,
} from './types'

interface Option {
  value: string
  label: string
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
  onChange: (filters: FilterState) => void
  fountains: Fountain[]
}

export function MapFilters({ filters, onChange, fountains }: MapFiltersProps) {
  const options = useMemo(() => buildFilterOptions(fountains), [fountains])
  const [expanded, setExpanded] = useState(false)

  const activeStateOptions: Option[] = useMemo(
    () =>
      (Object.keys(ACTIVE_STATE_LABELS) as ActiveState[]).map((value) => ({
        value,
        label: ACTIVE_STATE_LABELS[value],
      })),
    []
  )
  const toOptions = (list: { id: number; name: string }[]): Option[] =>
    list.map((o) => ({ value: String(o.id), label: o.name }))

  const hasActiveFilters =
    filters.activeStates.length > 0 ||
    filters.districtNumber !== null ||
    filters.sourceIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.activationTypeIds.length > 0 ||
    filters.ownerIds.length > 0 ||
    filters.hasActiveSignals ||
    filters.search.trim() !== ''

  return (
    <div
      style={{
        borderBottom: '1px solid var(--theme-elevation-200, #E5E7EB)',
        background: 'var(--theme-bg)',
        flexShrink: 0,
        padding: '8px 24px',
        gap: 8,
      }}
    >
      {/* Toggle bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <i
          className="fas fa-filter"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}
        />
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
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MultiSelect
              label="Работи"
              options={activeStateOptions}
              selected={filters.activeStates}
              onChange={(next) => onChange({ ...filters, activeStates: next as ActiveState[] })}
            />
            <MultiSelect
              label="Произход"
              options={toOptions(options.sources)}
              selected={filters.sourceIds}
              onChange={(next) => onChange({ ...filters, sourceIds: next })}
            />
            <MultiSelect
              label="Състояние"
              options={toOptions(options.statuses)}
              selected={filters.statusIds}
              onChange={(next) => onChange({ ...filters, statusIds: next })}
            />
            <MultiSelect
              label="Активиране"
              options={toOptions(options.activationTypes)}
              selected={filters.activationTypeIds}
              onChange={(next) => onChange({ ...filters, activationTypeIds: next })}
            />
            <MultiSelect
              label="Собственик"
              options={toOptions(options.owners)}
              selected={filters.ownerIds}
              onChange={(next) => onChange({ ...filters, ownerIds: next })}
            />

            {options.districts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--theme-text)', fontWeight: 500 }}>
                  Район:
                </span>
                <select
                  value={filters.districtNumber ?? ''}
                  onChange={(e) => onChange({ ...filters, districtNumber: e.target.value || null })}
                  style={CONTROL_STYLE}
                >
                  <option value="">Всички</option>
                  {options.districts.map((d) => (
                    <option key={d.number} value={String(d.number)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--theme-text)', fontWeight: 500 }}>
                Адрес:
              </span>
              <input
                type="text"
                value={filters.search}
                placeholder="напр. Борисова градина"
                onChange={(e) => onChange({ ...filters, search: e.target.value })}
                style={{ ...CONTROL_STYLE, cursor: 'text', width: 200 }}
              />
            </div>
          </div>
          <div
            style={{
              padding: '4px 24px 12px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
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
