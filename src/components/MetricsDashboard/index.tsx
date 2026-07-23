'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SofiaGerbMark } from '@/components/AdminBrand/SofiaGerbMark'
import { CollectionByGroupChart } from './charts/CollectionByGroupChart'
import { SignalsActiveByContainerStateChart } from './charts/SignalsActiveByContainerStateChart'
import { SignalsByAgeChart } from './charts/SignalsByAgeChart'
import { SignalsByStatusChart } from './charts/SignalsByStatusChart'
import { palette } from './charts/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictStat {
  districtId: number
  districtName: string
  totalContainers: number
  collectedContainers: number
}

interface ZoneStat {
  zoneNumber: number
  zoneName: string
  serviceCompanyId: number | null
  totalContainers: number
  collectedContainers: number
}

interface TimeBucketStat {
  bucket: string
  bucketOrder: number
  containerCount: number
}

interface DailyCollectionTrend {
  date: string
  totalContainers: number
  collectedContainers: number
}

interface MetricsData {
  from: string
  to: string
  byDistrict: DistrictStat[]
  byZone: ZoneStat[]
  byDay: DailyCollectionTrend[]
  byTimeSinceCollection: TimeBucketStat[]
  scheduleCompliance: {
    scheduledToday: number
    delayed: number
    missed: number
  }
}

interface DistrictOption {
  districtId: number
  name: string
}

type Range = 'day' | 'week' | 'month'

const DEFAULT_DISTRICT_IDS = [13, 24]
const VOLUME_OPTIONS = [0.11, 0.12, 0.24, 1.1, 3]
const DEFAULT_VOLUME_OPTIONS = [1.1, 3]

function buildRange(range: Range): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  if (range === 'day') {
    from.setDate(from.getDate())
  } else if (range === 'week') {
    from.setDate(from.getDate() - 6)
  } else {
    from.setDate(from.getDate() - 29)
  }
  return { from: from.toISOString(), to: now.toISOString() }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function RangeButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? palette.primaryLight : palette.border}`,
        background: active ? palette.primaryLight : palette.surface,
        color: active ? '#FFFFFF' : palette.textPrimary,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}

function DistrictFilter({
  options,
  selected,
  onChange,
}: {
  options: DistrictOption[]
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const toggle = (districtId: number) => {
    onChange(
      selected.includes(districtId)
        ? selected.filter((id) => id !== districtId)
        : [...selected, districtId]
    )
  }

  const buttonLabel =
    selected.length === 0
      ? 'Всички райони'
      : selected.length === 1
        ? (options.find((o) => o.districtId === selected[0])?.name ?? `Район ${selected[0]}`)
        : `${selected.length} избрани (${selected
            .map((id) => options.find((o) => o.districtId === id)?.name ?? `Район ${id}`)
            .join(', ')})`

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          padding: '7px 14px',
          borderRadius: 20,
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          color: palette.textPrimary,
          cursor: 'pointer',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Райони: {buttonLabel}
        <span style={{ fontSize: 10, color: palette.textMuted }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            minWidth: 220,
            maxHeight: 320,
            overflowY: 'auto',
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            padding: 6,
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 13, color: palette.textMuted }}>
              Зареждане на районите…
            </div>
          )}
          {options
            .sort((option) => (selected.includes(option.districtId) ? -1 : 1))
            .map((option) => {
              const isChecked = selected.includes(option.districtId)
              return (
                <label
                  key={option.districtId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: palette.textPrimary,
                    background: isChecked ? palette.surfaceHigh : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(option.districtId)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{option.name}</span>
                </label>
              )
            })}
        </div>
      )}
    </div>
  )
}

function VolumeFilter({
  options,
  selected,
  onChange,
}: {
  options: number[]
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const toggle = (volume: number) => {
    onChange(
      selected.includes(volume) ? selected.filter((v) => v !== volume) : [...selected, volume]
    )
  }

  const buttonLabel =
    selected.length === 0
      ? 'Всички обеми'
      : selected
          .slice()
          .sort((a, b) => a - b)
          .map((v) => `${v}`)
          .join(', ')

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          padding: '7px 14px',
          borderRadius: 20,
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          color: palette.textPrimary,
          cursor: 'pointer',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Обем (m³): {buttonLabel}
        <span style={{ fontSize: 10, color: palette.textMuted }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            minWidth: 180,
            maxHeight: 320,
            overflowY: 'auto',
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            padding: 6,
          }}
        >
          {options.map((volume) => {
            const isChecked = selected.includes(volume)
            return (
              <label
                key={volume}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: palette.textPrimary,
                  background: isChecked ? palette.surfaceHigh : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(volume)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{volume} m³</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

const MetricsDashboard: React.FC = () => {
  const [range, setRange] = useState<Range>('month')
  const [data, setData] = useState<MetricsData | null>(null)
  const [districts, setDistricts] = useState<number[]>(DEFAULT_DISTRICT_IDS)
  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([])
  const [volumeOptions, setVolumeOptions] = useState<number[]>(DEFAULT_VOLUME_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signalsExpanded, setSignalsExpanded] = useState(false)

  const fetchMetrics = useCallback(
    async (
      r: Range,
      handlers: {
        onStart: () => void
        onSuccess: (result: MetricsData) => void
        onError: (message: string) => void
        onFinally: () => void
      },
      districtIds?: number[],
      volumeOptions?: number[]
    ) => {
      handlers.onStart()
      handlers.onError('')
      try {
        const { from, to } = buildRange(r)

        const params = new URLSearchParams({
          from,
          to,
        })

        if (districtIds?.length) {
          params.set('districtIds', districtIds.join(','))
        }

        if (volumeOptions?.length) {
          params.set('volumeOptions', volumeOptions.join(','))
        }

        const res = await fetch(`/api/waste-containers/collection-metrics?${params.toString()}`)

        if (!res.ok) {
          const errorData = await res.json().catch(() => null)

          throw new Error(errorData?.error ?? errorData?.details ?? `HTTP ${res.status}`)
        }

        const result = (await res.json()) as MetricsData
        handlers.onSuccess(result)
      } catch (e) {
        handlers.onError(e instanceof Error ? e.message : 'Failed to load metrics')
      } finally {
        handlers.onFinally()
      }
    },
    []
  )

  useEffect(() => {
    fetchMetrics(
      range,
      {
        onStart: () => setLoading(true),
        onSuccess: setData,
        onError: (message) => setError(message || null),
        onFinally: () => setLoading(false),
      },
      districts,
      volumeOptions
    )
  }, [range, fetchMetrics, districts, volumeOptions])

  // Load the full list of city districts for the multi-select filter.
  useEffect(() => {
    let cancelled = false
    const fetchDistricts = async () => {
      try {
        const res = await fetch('/api/city-districts?limit=100&depth=0&sort=districtId')
        if (!res.ok) return
        const json = (await res.json()) as {
          docs?: { districtId: number; name: string }[]
        }
        if (cancelled) return
        setDistrictOptions(
          (json.docs ?? []).map((doc) => ({ districtId: doc.districtId, name: doc.name }))
        )
      } catch {
        // Non-fatal: the filter still works with the active selection, just without labels.
      }
    }
    void fetchDistricts()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 40px',
        maxWidth: 1200,
        margin: '0 auto',
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: palette.surfaceHigh,
          padding: '16px 20px',
          borderRadius: 12,
          border: `1px solid ${palette.border}`,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SofiaGerbMark size={48} />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: palette.textPrimary }}>
              Оперативни метрики за сметосъбирането в София
            </h1>
            {data && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>
                {new Date(data.from).toLocaleDateString('bg-BG')} –{' '}
                {new Date(data.to).toLocaleDateString('bg-BG')}
              </p>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <DistrictFilter options={districtOptions} selected={districts} onChange={setDistricts} />
        <VolumeFilter
          options={VOLUME_OPTIONS}
          selected={volumeOptions}
          onChange={setVolumeOptions}
        />
      </div>
      <div
        style={{
          height: 1,
          width: '100%',
          background: palette.border,
        }}
      />

      {data && (
        <>
          {(() => {
            const totalContainers = data.byZone.reduce((sum, zone) => sum + zone.totalContainers, 0)
            const collectedContainers = data.byZone.reduce(
              (sum, zone) => sum + zone.collectedContainers,
              0
            )
            const collectedPercentage =
              totalContainers > 0 ? Math.round((collectedContainers / totalContainers) * 100) : 0

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    {
                      label: 'Общо контейнери',
                      value: totalContainers,
                      color: palette.textPrimary,
                    },
                    {
                      label: 'Събрани за периода',
                      value: `${collectedContainers} (${collectedPercentage}%)`,
                      color: palette.textPrimary,
                    },
                    {
                      label: 'Зони',
                      value: data.byZone.length,
                      color: palette.textPrimary,
                    },
                    {
                      label: 'Райони',
                      value: data.byDistrict.filter((d) => d.collectedContainers > 0).length,
                      color: palette.textPrimary,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        flex: 1,
                        minWidth: 150,
                        background: palette.surface,
                        border: `1px solid ${palette.border}`,
                        borderRadius: 10,
                        padding: '12px 16px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: stat.color,
                        }}
                      >
                        {stat.value}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: palette.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <RangeButton
                    label="Последните 30 дни"
                    active={range === 'month'}
                    onClick={() => setRange('month')}
                  />
                  <RangeButton
                    label="Последните 7 дни"
                    active={range === 'week'}
                    onClick={() => setRange('week')}
                  />
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Loading / error states */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: palette.textSecondary }}>
          Зареждане на метриките…
        </div>
      )}
      {error && (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            color: palette.error,
          }}
        >
          <p style={{ margin: '0 0 12px' }}>Грешка при зареждане: {error}</p>
          <button
            onClick={() =>
              fetchMetrics(
                range,
                {
                  onStart: () => setLoading(true),
                  onSuccess: setData,
                  onError: (message) => setError(message || null),
                  onFinally: () => setLoading(false),
                },
                districts,
                volumeOptions
              )
            }
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: palette.primary,
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Опитай отново
          </button>
        </div>
      )}

      {/* Charts */}
      {!loading && !error && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CollectionByGroupChart
            byZone={data.byZone}
            byDistrict={data.byDistrict}
            byDay={data.byDay}
            title={`Тенденция на сметосъбирането ${range == 'month' ? 'за последните 30 дни' : range == 'week' ? 'за последните 7 дни' : ''}`}
          />

          {/* <TimeSinceCollectionChart data={data.byTimeSinceCollection} />
          <ScheduleComplianceChart compliance={data.scheduleCompliance} />
          <NewlyCreatedContainersChart /> */}

          <div
            style={{
              background: palette.surface,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    color: palette.textPrimary,
                  }}
                >
                  Сигнали
                </h2>

                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 13,
                    color: palette.textSecondary,
                  }}
                >
                  Метрики за потребителските сигнали и състоянието на контейнерите
                </p>
              </div>

              <button
                type="button"
                aria-expanded={signalsExpanded}
                aria-controls="signals-metrics"
                onClick={() => setSignalsExpanded((expanded) => !expanded)}
                style={{
                  flexShrink: 0,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.primary}`,
                  background: signalsExpanded ? palette.primary : palette.surface,
                  color: signalsExpanded ? '#FFFFFF' : palette.primary,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {signalsExpanded ? 'Скрий' : 'Покажи'}
              </button>
            </div>

            {signalsExpanded && (
              <div
                id="signals-metrics"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  marginTop: 24,
                }}
              >
                <SignalsByAgeChart type={'waste-container'} />
                <SignalsByStatusChart type={'waste-container'} />
                <SignalsActiveByContainerStateChart type={'waste-container'} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MetricsDashboard
