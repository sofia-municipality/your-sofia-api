import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { palette } from './shared'

interface ScheduleComplianceItem {
  status: string
  count: number
  color: string
}

interface ScheduleComplianceChartProps {
  compliance: {
    scheduledToday: number
    delayed: number
    missed: number
  } | null
}

export function ScheduleComplianceChart({ compliance }: ScheduleComplianceChartProps) {
  const data: ScheduleComplianceItem[] = compliance
    ? [
        {
          status: 'В график',
          count: Math.max(0, compliance.scheduledToday - compliance.delayed),
          color: palette.success,
        },
        {
          status: 'Закъснение',
          count: Math.max(0, compliance.delayed - compliance.missed),
          color: palette.warning,
        },
        {
          status: 'Пропуснати',
          count: compliance.missed,
          color: palette.error,
        },
      ]
    : []

  return (
    <div style={{ marginBottom: 48 }}>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 12,
          color: palette.textPrimary,
        }}
      >
        Изпълнение на графика
      </h3>
      {data.length === 0 ? (
        <p style={{ color: palette.textMuted, fontSize: 14 }}>Няма налични данни.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            {data.map((item) => (
              <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: item.color,
                  }}
                />
                <span style={{ fontSize: 12, color: palette.textSecondary }}>{item.status}</span>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 400, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
                  <XAxis
                    dataKey="status"
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
                    cursor={{ fill: 'transparent', stroke: palette.border, strokeWidth: 2 }}
                    contentStyle={{
                      backgroundColor: palette.surface,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 10,
                      color: palette.textPrimary,
                    }}
                    labelStyle={{ color: palette.textPrimary }}
                    itemStyle={{ color: palette.textPrimary }}
                    formatter={(value) => [value, 'Контейнери']}
                  />
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(bar) => {
                      const status = (bar?.payload as any)?.status as string | undefined
                      if (!status) return

                      const params = new URLSearchParams({
                        zoom: '13',
                        status: 'active',
                        scheduledToday: 'true',
                      })
                      switch (status) {
                        case 'В график':
                          params.set('scheduleCategory', 'onTime')
                          break
                        case 'Закъснение':
                          params.set('scheduleCategory', 'delayed')
                          break
                        case 'Пропуснати':
                          params.set('scheduleCategory', 'missed')
                          break
                        default:
                          return
                      }
                      window.open(
                        `/admin/waste-map?${params.toString()}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }}
                  >
                    {data.map((item) => (
                      <Cell key={item.status} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
