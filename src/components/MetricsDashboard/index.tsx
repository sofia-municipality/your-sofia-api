'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { SofiaGerbMark } from '@/components/AdminBrand/SofiaGerbMark'
import { CollectionByGroupChart } from './charts/CollectionByGroupChart'
import { NewlyCreatedContainersChart } from './charts/NewlyCreatedContainersChart'
import { ScheduleComplianceChart } from './charts/ScheduleComplianceChart'
import { SignalsActiveByContainerStateChart } from './charts/SignalsActiveByContainerStateChart'
import { SignalsByAgeChart } from './charts/SignalsByAgeChart'
import { SignalsByStatusChart } from './charts/SignalsByStatusChart'
import { palette } from './charts/shared'
import { TimeSinceCollectionChart } from './charts/TimeSinceCollectionChart'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictStat {
  districtId: string
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

type Range = 'day' | 'week' | 'month'

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

// ─── Main Component ────────────────────────────────────────────────────────

const MetricsDashboard: React.FC = () => {
  const [range, setRange] = useState<Range>('week')
  const [data, setData] = useState<MetricsData | null>(null)
  const [monthData, setMonthData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthLoading, setMonthLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthError, setMonthError] = useState<string | null>(null)

  const fetchMetrics = useCallback(
    async (
      r: Range,
      handlers: {
        onStart: () => void
        onSuccess: (result: MetricsData) => void
        onError: (message: string) => void
        onFinally: () => void
      }
    ) => {
      handlers.onStart()
      handlers.onError('')
      try {
        const { from, to } = buildRange(r)
        const res = await fetch(
          `/api/waste-containers/collection-metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        handlers.onSuccess(await res.json())
      } catch (e) {
        handlers.onError(e instanceof Error ? e.message : 'Failed to load metrics')
      } finally {
        handlers.onFinally()
      }
    },
    []
  )

  useEffect(() => {
    fetchMetrics(range, {
      onStart: () => setLoading(true),
      onSuccess: setData,
      onError: (message) => setError(message || null),
      onFinally: () => setLoading(false),
    })
  }, [range, fetchMetrics])

  useEffect(() => {
    fetchMetrics('month', {
      onStart: () => setMonthLoading(true),
      onSuccess: setMonthData,
      onError: (message) => setMonthError(message || null),
      onFinally: () => setMonthLoading(false),
    })
  }, [fetchMetrics])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: palette.surfaceHigh,
          padding: '16px 20px',
          borderRadius: 12,
          marginBottom: 32,
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

      {/* Summary stats */}
      {data && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
          {(() => {
            const totalContainers = data.byZone.reduce((sum, zone) => sum + zone.totalContainers, 0)
            const collectedContainers = data.byZone.reduce(
              (sum, zone) => sum + zone.collectedContainers,
              0
            )
            const collectedPercentage =
              totalContainers > 0 ? Math.round((collectedContainers / totalContainers) * 100) : 0

            return [
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
            ]
          })().map((stat) => (
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
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: palette.textSecondary }}>
          Зареждане на метриките…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 40, color: palette.error }}>
          <p style={{ margin: '0 0 12px' }}>Грешка при зареждане: {error}</p>
          <button
            onClick={() =>
              fetchMetrics(range, {
                onStart: () => setLoading(true),
                onSuccess: setData,
                onError: (message) => setError(message || null),
                onFinally: () => setLoading(false),
              })
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
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <RangeButton label="Днес" active={range === 'day'} onClick={() => setRange('day')} />
            <RangeButton
              label="Последните 7 дни"
              active={range === 'week'}
              onClick={() => setRange('week')}
            />
            <RangeButton
              label="Последните 30 дни"
              active={range === 'month'}
              onClick={() => setRange('month')}
            />
          </div>

          <CollectionByGroupChart
            byZone={data.byZone}
            byDistrict={data.byDistrict}
            byDay={data.byDay}
          />
          <TimeSinceCollectionChart data={data.byTimeSinceCollection} />
          <ScheduleComplianceChart compliance={data.scheduleCompliance} />
          <NewlyCreatedContainersChart />

          <div style={{ marginTop: 32, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: palette.textPrimary }}>
              Сигнали
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: palette.textSecondary }}>
              Метрики за клиентските сигнали и състоянието на контейнерите.
            </p>
          </div>

          <SignalsByAgeChart />
          <SignalsByStatusChart />
          <SignalsActiveByContainerStateChart />
        </>
      )}
    </div>
  )
}

export default MetricsDashboard
