'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { palette } from './shared'

interface SignalAgePoint {
  bucket: string
  bucket_order: number
  count: number
}

interface ApiResponse {
  data: SignalAgePoint[]
}

export function SignalsByAgeChart() {
  const [data, setData] = useState<SignalAgePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/signals-age-metric')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json = (await response.json()) as ApiResponse
        setData(json.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Грешка при зареждане на сигнали')
      } finally {
        setLoading(false)
      }
    }

    void fetchMetrics()
  }, [])

  const chartData = useMemo(
    () =>
      data
        .slice()
        .sort((a, b) => a.bucket_order - b.bucket_order)
        .map((point) => ({
          bucket: point.bucket,
          count: point.count,
        })),
    [data]
  )

  return (
    <div style={{ marginBottom: 48 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: palette.textPrimary }}>
        Брой сигнали по възраст на създаване
      </h3>
      <p style={{ fontSize: 13, color: palette.textSecondary, marginTop: -4, marginBottom: 16 }}>
        Разпределение на сигналите според времето от тяхното подаване.
      </p>

      <div style={{ position: 'relative', minHeight: 320 }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.textSecondary,
              fontSize: 14,
            }}
          >
            Зареждане на графиката…
          </div>
        )}

        {error && <div style={{ color: palette.error, fontSize: 14 }}>{error}</div>}

        {!loading && !error && chartData.length === 0 && (
          <div style={{ color: palette.textSecondary, fontSize: 14 }}>
            Няма данни за този диаграм.
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(420, chartData.length * 110), height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11, fill: palette.textSecondary }}
                    axisLine={{ stroke: palette.border }}
                    tickLine={{ stroke: palette.border }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: palette.textSecondary }}
                    axisLine={{ stroke: palette.border }}
                    tickLine={{ stroke: palette.border }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent', stroke: palette.border, strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: palette.surface,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 10,
                      color: palette.textPrimary,
                    }}
                    labelStyle={{ color: palette.textPrimary }}
                    itemStyle={{ color: palette.textPrimary }}
                    formatter={(value) => [value, 'Сигнали']}
                  />
                  <Bar
                    dataKey="count"
                    fill={palette.primary}
                    radius={[4, 4, 0, 0]}
                    onClick={(bar) => {
                      const bucket = (bar?.payload as any)?.bucket as string | undefined
                      if (!bucket) return

                      const params = new URLSearchParams({
                        zoom: '13',
                        signalAgeBucket: bucket,
                      })
                      window.open(
                        `/admin/waste-map?${params.toString()}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      fill={palette.textSecondary}
                      fontSize={11}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
