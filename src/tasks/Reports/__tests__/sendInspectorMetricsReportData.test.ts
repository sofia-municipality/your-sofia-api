jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { BasePayload } from 'payload'
import { loadInspectorMetricsReportData } from '../sendInspectorMetricsReportData'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type QueryName = 'total' | 'containers' | 'signals' | 'trend'
type Rows = Partial<Record<QueryName, unknown[]>>

const queryName = (query: SqlFragment): QueryName => {
  const text = query.strings.join('?')
  if (text.includes('day_series')) return 'trend'
  if (text.includes('FROM signals')) return 'signals'
  if (text.includes('containers_collected_last_24h')) return 'containers'
  if (text.includes('total_containers')) return 'total'
  throw new Error(`Unexpected query: ${text}`)
}

const makePayload = (rows: Rows = {}) => ({
  db: {
    drizzle: {
      execute: jest.fn(async (query: SqlFragment) => ({ rows: rows[queryName(query)] ?? [] })),
    },
  },
})

type MockPayload = ReturnType<typeof makePayload>

const asPayload = (payload: MockPayload) => payload as unknown as BasePayload

const paramsOf = (payload: MockPayload, name: QueryName): unknown[] => {
  const call = payload.db.drizzle.execute.mock.calls.find(([query]) => queryName(query) === name)
  if (!call) throw new Error(`Expected the ${name} query to have been executed`)
  return call[0].values
}

const NOW = new Date('2026-03-15T10:30:00.000Z')

describe('loadInspectorMetricsReportData', () => {
  it('maps the aggregate rows into the report summary', async () => {
    const payload = makePayload({
      total: [{ total_containers: 1200 }],
      containers: [
        {
          containers_collected_last_24h: 80,
          observations_last_24h: 95,
          containers_collected_last_7d: 600,
          observations_last_7d: 700,
          containers_collected_month_to_date: 1100,
        },
      ],
      signals: [
        {
          active_signals: 14,
          pending_signals: 9,
          in_progress_signals: 5,
          resolved_signals: 40,
          new_signals_last_24h: 3,
          new_signals_last_7d: 21,
          new_signals_month_to_date: 33,
        },
      ],
    })

    const { summary } = await loadInspectorMetricsReportData(asPayload(payload), NOW)

    expect(summary).toEqual({
      totalContainers: 1200,
      containersCollectedLast24h: 80,
      observationsLast24h: 95,
      containersCollectedLast7d: 600,
      containersCollectedMonthToDate: 1100,
      activeSignals: 14,
      newSignalsLast24h: 3,
      newSignalsLast7d: 21,
      newSignalsMonthToDate: 33,
      pendingSignals: 9,
      inProgressSignals: 5,
      resolvedSignals: 40,
    })
  })

  it('coerces numeric strings returned by the driver', async () => {
    const payload = makePayload({
      total: [{ total_containers: '1200' }],
      containers: [{ containers_collected_last_24h: '80' }],
      signals: [{ pending_signals: '9' }],
      trend: [{ date: '2026-03-15', collected_containers: '12' }],
    })

    const { summary, collectionTrend } = await loadInspectorMetricsReportData(
      asPayload(payload),
      NOW
    )

    expect(summary).toMatchObject({
      totalContainers: 1200,
      containersCollectedLast24h: 80,
      pendingSignals: 9,
    })
    expect(collectionTrend).toEqual([{ date: '2026-03-15', collectedContainers: 12 }])
  })

  it('reports zeros when the queries return no rows', async () => {
    const { summary, collectionTrend } = await loadInspectorMetricsReportData(
      asPayload(makePayload()),
      NOW
    )

    expect(Object.values(summary)).toHaveLength(12)
    expect(Object.values(summary).every((value) => value === 0)).toBe(true)
    expect(collectionTrend).toEqual([])
  })

  it('treats missing columns as zero', async () => {
    const payload = makePayload({
      total: [{ total_containers: null }],
      containers: [{ observations_last_24h: 7 }],
      signals: [{ resolved_signals: 2, active_signals: null }],
    })

    const { summary } = await loadInspectorMetricsReportData(asPayload(payload), NOW)

    expect(summary).toMatchObject({
      totalContainers: 0,
      containersCollectedLast24h: 0,
      observationsLast24h: 7,
      activeSignals: 0,
      resolvedSignals: 2,
    })
  })

  it('maps the daily trend in order, defaulting missing counts to zero', async () => {
    const payload = makePayload({
      trend: [
        { date: '2026-03-08', collected_containers: 3 },
        { date: '2026-03-09', collected_containers: null },
        { date: '2026-03-10', collected_containers: 11 },
      ],
    })

    const { collectionTrend } = await loadInspectorMetricsReportData(asPayload(payload), NOW)

    expect(collectionTrend).toEqual([
      { date: '2026-03-08', collectedContainers: 3 },
      { date: '2026-03-09', collectedContainers: 0 },
      { date: '2026-03-10', collectedContainers: 11 },
    ])
  })

  it('uses rolling 24-hour and 7-day windows plus the month start', async () => {
    const payload = makePayload()
    const dayAgo = '2026-03-14T10:30:00.000Z'
    const weekAgo = '2026-03-08T10:30:00.000Z'
    // The exact month-start instant depends on the server time zone; only its month is checked.
    const monthStart = expect.stringMatching(/^2026-0[23]-(01|28)T/)

    await loadInspectorMetricsReportData(asPayload(payload), NOW)

    expect(paramsOf(payload, 'total')).toEqual([])
    expect(paramsOf(payload, 'containers')).toEqual([dayAgo, dayAgo, weekAgo, weekAgo, monthStart])
    expect(paramsOf(payload, 'signals')).toEqual([dayAgo, weekAgo, monthStart])
    expect(paramsOf(payload, 'trend')).toEqual([
      weekAgo,
      NOW.toISOString(),
      weekAgo,
      NOW.toISOString(),
    ])
    // Deriving the month start must not mutate the caller's date.
    expect(NOW.toISOString()).toBe('2026-03-15T10:30:00.000Z')
  })

  // BUG (bugs.md #8): the month start is local midnight on the 1st, but the report counts days in
  // Europe/Sofia, so on a UTC server "month to date" starts 2-3 hours late.
  it.failing('starts the month at midnight Sofia time on a UTC server', async () => {
    // Jest ignores TZ changes at runtime, so emulate a UTC server: local setters act like UTC ones.
    const spies = [
      jest.spyOn(Date.prototype, 'setDate').mockImplementation(function (this: Date, date: number) {
        return this.setUTCDate(date)
      }),
      jest.spyOn(Date.prototype, 'setHours').mockImplementation(function (
        this: Date,
        hours: number,
        minutes?: number,
        seconds?: number,
        ms?: number
      ) {
        return this.setUTCHours(hours, minutes ?? 0, seconds ?? 0, ms ?? 0)
      }),
    ]
    const payload = makePayload()

    try {
      await loadInspectorMetricsReportData(asPayload(payload), NOW)
    } finally {
      spies.forEach((spy) => spy.mockRestore())
    }

    // 1 March 2026, 00:00 in Sofia (UTC+2)
    expect(paramsOf(payload, 'signals')[2]).toBe('2026-02-28T22:00:00.000Z')
  })

  it('propagates query failures', async () => {
    const payload = makePayload()
    payload.db.drizzle.execute.mockRejectedValueOnce(new Error('db down'))

    await expect(loadInspectorMetricsReportData(asPayload(payload), NOW)).rejects.toThrow('db down')
  })
})
