import React, { useState } from 'react'
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
import { palette } from './shared'

type CollectionByGroupChartProps = {
  groupBy?: 'zone' | 'district' | 'day'
  byZone?: Array<{
    zoneName: string
    zoneNumber: number
    collectedContainers: number
    totalContainers: number
  }>
  byDistrict?: Array<{
    districtName: string
    districtId: number
    collectedContainers: number
    totalContainers: number
  }>
  byDay?: Array<{
    date: string
    collectedContainers: number
    totalContainers: number
  }>
  title?: string
}

const EMPTY_ZONE_DATA: Array<{
  zoneName: string
  zoneNumber: number
  collectedContainers: number
  totalContainers: number
}> = []

const EMPTY_DISTRICT_DATA: Array<{
  districtName: string
  districtId: number
  collectedContainers: number
  totalContainers: number
}> = []

const EMPTY_DAY_DATA: Array<{
  date: string
  collectedContainers: number
  totalContainers: number
}> = []

export function CollectionByGroupChart({
  title,
  groupBy: fixedGroupBy,
  ...props
}: CollectionByGroupChartProps) {
  const [tab, setTab] = useState<'zone' | 'district' | 'day'>(fixedGroupBy ?? 'district')
  const groupBy = fixedGroupBy ?? tab
  const showTabs = fixedGroupBy === undefined

  let resolvedTitle = title
  if (!resolvedTitle) {
    switch (groupBy) {
      case 'zone':
        resolvedTitle = 'По зона за сметосъбиране'
        break
      case 'district':
        resolvedTitle = 'По административен район'
        break
      case 'day':
        resolvedTitle = 'Тенденция на сметосъбирането - последните 30 дни'
        break
    }
  }

  let data: Array<{
    name: string
    collectedContainers: number
    notCollectedContainers: number
    params?: Record<string, string>
  }>
  switch (groupBy) {
    case 'day':
      data = (props.byDay ?? EMPTY_DAY_DATA).map((day) => {
        const [, month, date] = day.date.slice(0, 10).split('-')
        const from = day.date
        const to = new Date(`${day.date}T00:00:00.000Z`)
        to.setDate(to.getDate() + 1)
        return {
          name: `${date}.${month}`,
          collectedContainers: day.collectedContainers,
          notCollectedContainers: Math.max(0, day.totalContainers - day.collectedContainers),
          params: {
            createdFrom: from,
            createdTo: to.toISOString(),
            zoom: '13',
          },
        }
      })
      break
    case 'zone':
      data = (props.byZone ?? EMPTY_ZONE_DATA).map((zone) => ({
        name: zone.zoneName,
        collectedContainers: zone.collectedContainers,
        notCollectedContainers: zone.totalContainers - zone.collectedContainers,
        params: {
          zoneNumber: String(zone.zoneNumber),
          zoom: '12',
        },
      }))
      break
    case 'district':
      data = (props.byDistrict ?? EMPTY_DISTRICT_DATA).map((district) => ({
        name: district.districtName,
        collectedContainers: district.collectedContainers,
        notCollectedContainers: district.totalContainers - district.collectedContainers,
        params: {
          districtId: String(district.districtId),
          zoom: '12',
        },
      }))
      break
  }

  const barWidth = Math.max(360, data.length * (groupBy === 'day' ? 34 : 56))
  const xAxisAngle = groupBy === 'day' ? -45 : -40
  const xAxisTickMargin = groupBy === 'day' ? 8 : 6

  return (
    <div style={{ marginBottom: groupBy === 'day' ? 48 : 20 }}>
      {showTabs && (
        <div
          style={{
            display: 'flex',
            backgroundColor: palette.border,
            borderRadius: 8,
            padding: 2,
            maxWidth: 320,
            marginBottom: 12,
          }}
        >
          {(['district', 'zone', 'day'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 6,
                backgroundColor: tab === t ? palette.surface : 'transparent',
                color: tab === t ? palette.primary : palette.textSecondary,
                fontSize: 13,
                fontWeight: tab === t ? 600 : 500,
                padding: '8px 0',
                cursor: 'pointer',
              }}
            >
              {t === 'district' ? 'По район' : t === 'zone' ? 'По зона' : 'По дата'}
            </button>
          ))}
        </div>
      )}
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: palette.textPrimary }}>
        {resolvedTitle}
      </h3>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: palette.border,
            }}
          />
          <span style={{ fontSize: 12, color: palette.textSecondary }}>Общо контейнери</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: palette.primary,
            }}
          />
          <span style={{ fontSize: 12, color: palette.textSecondary }}>Събрани</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: barWidth }}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: palette.textSecondary }}
                angle={xAxisAngle}
                textAnchor="end"
                interval={0}
                tickMargin={xAxisTickMargin}
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
                formatter={(value, name) =>
                  name === 'collectedContainers' ? [value, 'Събрани'] : [value, 'Общо контейнери']
                }
              />
              <Legend wrapperStyle={{ display: 'none' }} />
              <Bar
                dataKey="collectedContainers"
                stackId="a"
                fill={palette.primary}
                name="collectedContainers"
                radius={[3, 3, 0, 0]}
                label={{ position: 'top', fontSize: 10, fill: palette.textSecondary }}
                cursor="pointer"
                onClick={(bar) => {
                  const params = (bar?.payload as any)?.params as Record<string, string> | undefined
                  if (!params) return
                  const search = new URLSearchParams(params)
                  window.open(
                    `/admin/waste-map?${search.toString()}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }}
              />
              <Bar
                dataKey="notCollectedContainers"
                stackId="a"
                fill={palette.border}
                name="notCollectedContainers"
                radius={[3, 3, 0, 0]}
                label={{ position: 'insideTop', fontSize: 10, fill: palette.textSecondary }}
                cursor="pointer"
                onClick={(bar) => {
                  const params = (bar?.payload as any)?.params as Record<string, string> | undefined
                  if (!params) return
                  const search = new URLSearchParams(params)
                  window.open(
                    `/admin/waste-map?${search.toString()}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
