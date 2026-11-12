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

const PERIOD_DAYS = 30

interface NewContainerPoint {
  date: string
  count: number
}

interface ApiResponse {
  from: string
  to: string
  byDay: NewContainerPoint[]
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function NewlyCreatedContainersChart() {
  const today = useMemo(() => startOfUtcDay(new Date()), [])
  const [periodStart, setPeriodStart] = useState<Date>(() => addUtcDays(today, -(PERIOD_DAYS - 1)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<NewContainerPoint[]>([])
  const [fromLabel, setFromLabel] = useState<string>('')
  const [toLabel, setToLabel] = useState<string>('')

  const periodEnd = useMemo(() => addUtcDays(periodStart, PERIOD_DAYS - 1), [periodStart])
  const isNextDisabled = periodEnd >= today

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          from: toYmd(periodStart),
          to: toYmd(periodEnd),
        })
        const response = await fetch(
          `/api/waste-containers/newly-created-containers-metric?${params}`
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json = (await response.json()) as ApiResponse
        setData(json.byDay ?? [])
        setFromLabel(new Date(json.from).toLocaleDateString('bg-BG'))
        setToLabel(new Date(json.to).toLocaleDateString('bg-BG'))
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Грешка при зареждане на новосъздадените контейнери'
        )
      } finally {
        setLoading(false)
      }
    }

    void fetchMetrics()
  }, [periodStart, periodEnd])

  const chartData = data.map((day) => {
    const [year, month, date] = day.date.split('-')
    return {
      ...day,
      label: `${date}.${month}`,
      dayEndExclusive: toYmd(
        addUtcDays(new Date(Date.UTC(Number(year), Number(month) - 1, Number(date))), 1)
      ),
    }
  })

  const openMapForDay = (date: string, dayEndExclusive: string) => {
    const params = new URLSearchParams({
      status: 'pending',
      createdFrom: date,
      createdTo: dayEndExclusive,
      zoom: '16',
    })

    window.open(`/admin/waste-map?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ marginBottom: 48 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: palette.textPrimary }}>
            Новосъздадени контейнери
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: palette.textSecondary }}>
            Новосъздадени контейнери в статус „чакащ“ по дни ({fromLabel} - {toLabel})
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setPeriodStart((prev) => addUtcDays(prev, -PERIOD_DAYS))}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              color: palette.textPrimary,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Предишни
          </button>
          <button
            type="button"
            disabled={isNextDisabled}
            onClick={() => setPeriodStart((prev) => addUtcDays(prev, PERIOD_DAYS))}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${palette.border}`,
              background: isNextDisabled ? palette.border : palette.surface,
              color: isNextDisabled ? palette.textMuted : palette.textPrimary,
              cursor: isNextDisabled ? 'default' : 'pointer',
              fontSize: 12,
            }}
          >
            Следващи
          </button>
        </div>
      </div>

      {error && <p style={{ color: palette.error, fontSize: 14 }}>Грешка при зареждане: {error}</p>}

      <div style={{ position: 'relative', minHeight: 320 }}>
        {chartData.length > 0 && !error && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(900, chartData.length * 36), height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: palette.textSecondary }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    tickMargin={8}
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
                    formatter={(value) => [value, 'Контейнери в изчакване']}
                  />
                  <Bar
                    dataKey="count"
                    fill={palette.warning}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(barData) => {
                      const clickedDay = barData?.payload as
                        | { date?: string; dayEndExclusive?: string }
                        | undefined
                      if (!clickedDay?.date || !clickedDay?.dayEndExclusive) return
                      openMapForDay(clickedDay.date, clickedDay.dayEndExclusive)
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

        {!loading && !error && chartData.length === 0 && (
          <div
            style={{
              height: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.textSecondary,
              fontSize: 14,
            }}
          >
            Няма данни за този период.
          </div>
        )}
      </div>
    </div>
  )
}
