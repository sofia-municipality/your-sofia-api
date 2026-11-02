jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { PayloadRequest } from 'payload'
import { newlyCreatedContainersMetric } from '../newly-created-containers-metric'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type MetricBody = { from: string; to: string; byDay: Array<{ date: string; count: number }> }

const makePayload = (rows: unknown[] = []) => ({
  db: { drizzle: { execute: jest.fn(async (_query: SqlFragment) => ({ rows })) } },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, string> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

// The query interpolates [from, toExclusive] twice: once for the day series, once for the filter.
const executedParams = (payload: MockPayload): unknown[] => {
  const [call] = payload.db.drizzle.execute.mock.calls
  if (!call) throw new Error('Expected a SQL query to have been executed')
  return call[0].values
}

describe('newlyCreatedContainersMetric endpoint (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('defaults to the last 30 days including today (UTC)', async () => {
    jest.useFakeTimers({ now: new Date('2026-03-15T10:30:00.000Z') })
    const payload = makePayload()

    const res = await newlyCreatedContainersMetric.handler(makeReq(payload))

    expect(res.status).toBe(200)
    const body: MetricBody = await res.json()
    expect(body.from).toBe('2026-02-14T00:00:00.000Z')
    expect(body.to).toBe('2026-03-15T00:00:00.000Z')
    expect(executedParams(payload)).toEqual([
      '2026-02-14T00:00:00.000Z',
      '2026-03-16T00:00:00.000Z',
      '2026-02-14T00:00:00.000Z',
      '2026-03-16T00:00:00.000Z',
    ])
  })

  it('normalizes custom from/to to the start of their UTC days', async () => {
    const payload = makePayload()

    const res = await newlyCreatedContainersMetric.handler(
      makeReq(payload, { from: '2026-01-05T15:30:00.000Z', to: '2026-01-10T23:59:59.000Z' })
    )

    const body: MetricBody = await res.json()
    expect(body.from).toBe('2026-01-05T00:00:00.000Z')
    expect(body.to).toBe('2026-01-10T00:00:00.000Z')
    expect(executedParams(payload)).toEqual([
      '2026-01-05T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
    ])
  })

  it('falls back to defaults for unparseable dates', async () => {
    jest.useFakeTimers({ now: new Date('2026-03-15T10:30:00.000Z') })

    const res = await newlyCreatedContainersMetric.handler(
      makeReq(makePayload(), { from: 'not-a-date', to: 'also-not-a-date' })
    )

    const body: MetricBody = await res.json()
    expect(body.from).toBe('2026-02-14T00:00:00.000Z')
    expect(body.to).toBe('2026-03-15T00:00:00.000Z')
  })

  it('clamps `to` to `from` when the range is reversed', async () => {
    const payload = makePayload()

    const res = await newlyCreatedContainersMetric.handler(
      makeReq(payload, { from: '2026-01-10', to: '2026-01-05' })
    )

    const body: MetricBody = await res.json()
    expect(body.from).toBe('2026-01-10T00:00:00.000Z')
    expect(body.to).toBe('2026-01-10T00:00:00.000Z')
    expect(executedParams(payload)).toEqual([
      '2026-01-10T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
      '2026-01-10T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
    ])
  })

  it('maps rows to daily counts', async () => {
    const payload = makePayload([
      { day_iso: '2026-01-01', container_count: 0 },
      { day_iso: '2026-01-02', container_count: 3 },
    ])

    const res = await newlyCreatedContainersMetric.handler(
      makeReq(payload, { from: '2026-01-01', to: '2026-01-02' })
    )

    const body: MetricBody = await res.json()
    expect(body.byDay).toEqual([
      { date: '2026-01-01', count: 0 },
      { date: '2026-01-02', count: 3 },
    ])
  })

  it('returns 500 with details when the query fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const payload = makePayload()
    payload.db.drizzle.execute.mockRejectedValue(new Error('db down'))

    const res = await newlyCreatedContainersMetric.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch newly created container metrics',
      details: 'db down',
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
