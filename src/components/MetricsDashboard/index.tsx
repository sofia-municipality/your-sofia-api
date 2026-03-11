'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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

interface MetricsData {
  from: string
  to: string
  byDistrict: DistrictStat[]
  byZone: ZoneStat[]
  byTimeSinceCollection: TimeBucketStat[]
}

type Range = 'day' | 'week' | 'month'

function buildRange(range: Range): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  if (range === 'day') from.setDate(from.getDate() - 1)
  else if (range === 'week') from.setDate(from.getDate() - 7)
  else from.setDate(from.getDate() - 30)
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
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid #d1d5db',
        background: active ? '#1E40AF' : '#fff',
        color: active ? '#fff' : '#374151',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}

function ChartSection({
  title,
  data,
  dataKey,
  nameKey,
}: {
  title: string
  data: Record<string, unknown>[]
  dataKey: { collected: string; notCollected: string }
  nameKey: string
}) {
  const barWidth = Math.max(600, data.length * 60)
  return (
    <div style={{ marginBottom: 48 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#111827' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: barWidth }}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={nameKey}
                tick={{ fontSize: 11 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === dataKey.collected ? 'Collected (in period)' : 'Not yet collected',
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === dataKey.collected ? 'Collected (in period)' : 'Not yet collected'
                }
                wrapperStyle={{ paddingTop: 8, fontSize: 13 }}
              />
              <Bar
                dataKey={dataKey.collected}
                stackId="a"
                fill="#1E40AF"
                name={dataKey.collected}
              />
              <Bar
                dataKey={dataKey.notCollected}
                stackId="a"
                fill="#D1D5DB"
                name={dataKey.notCollected}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

const MetricsDashboard: React.FC = () => {
  const [range, setRange] = useState<Range>('week')
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (r: Range) => {
    setLoading(true)
    setError(null)
    try {
      const { from, to } = buildRange(r)
      const res = await fetch(
        `/api/waste-containers/collection-metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics(range)
  }, [range, fetchMetrics])

  const zoneChartData = (data?.byZone ?? []).map((z) => ({
    name: z.zoneName,
    collectedContainers: z.collectedContainers,
    notCollectedContainers: z.totalContainers - z.collectedContainers,
  }))

  const districtChartData = (data?.byDistrict ?? []).map((d) => ({
    name: d.districtName,
    collectedContainers: d.collectedContainers,
    notCollectedContainers: d.totalContainers - d.collectedContainers,
  }))

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
            Waste Collection Metrics
          </h1>
          {data && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              {new Date(data.from).toLocaleDateString()} – {new Date(data.to).toLocaleDateString()}
            </p>
          )}
        </div>
        {/* Range selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          <RangeButton label="Last Day" active={range === 'day'} onClick={() => setRange('day')} />
          <RangeButton
            label="Last Week"
            active={range === 'week'}
            onClick={() => setRange('week')}
          />
          <RangeButton
            label="Last Month"
            active={range === 'month'}
            onClick={() => setRange('month')}
          />
        </div>
      </div>

      {/* Summary stats */}
      {data && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
          {[
            {
              label: 'Total Containers',
              value: data.byZone.reduce((s, z) => s + z.totalContainers, 0),
              color: '#6B7280',
            },
            {
              label: 'Collected in Period',
              value: data.byZone.reduce((s, z) => s + z.collectedContainers, 0),
              color: '#1E40AF',
            },
            {
              label: 'Zones',
              value: data.byZone.length,
              color: '#059669',
            },
            {
              label: 'Districts with Data',
              value: data.byDistrict.filter((d) => d.collectedContainers > 0).length,
              color: '#D97706',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '16px 24px',
                minWidth: 150,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Loading metrics…</div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 40, color: '#DC2626' }}>
          <p style={{ margin: '0 0 12px' }}>Failed to load: {error}</p>
          <button
            onClick={() => fetchMetrics(range)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: '#1E40AF',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Charts */}
      {!loading && !error && data && (
        <>
          <ChartSection
            title="By Collection Zone"
            data={zoneChartData}
            dataKey={{ collected: 'collectedContainers', notCollected: 'notCollectedContainers' }}
            nameKey="name"
          />
          <ChartSection
            title="By Administrative District"
            data={districtChartData}
            dataKey={{ collected: 'collectedContainers', notCollected: 'notCollectedContainers' }}
            nameKey="name"
          />
          {/* Time-since-last-collection histogram */}
          <div style={{ marginBottom: 48 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#111827' }}>
              Time Since Last Collection
            </h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, marginTop: -8 }}>
              Distribution of containers by time elapsed since their most recent collection event.
            </p>
            {data.byTimeSinceCollection.length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: 14 }}>No collection data available yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 400 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.byTimeSinceCollection.map((b) => ({
                        bucket: b.bucket,
                        containers: b.containerCount,
                      }))}
                      margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [value, 'Containers']} />
                      <Bar dataKey="containers" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MetricsDashboard
