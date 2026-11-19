jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}))

import type { Endpoint, PayloadRequest } from 'payload'
import {
  signalsActiveContainerStateMetric,
  signalsAgeMetric,
  signalsStatusMetric,
} from '../signals-metrics'

type SqlFragment = { strings: readonly string[]; values: unknown[] }
type Row = Record<string, unknown>

const makePayload = (rows: Row[] = []) => ({
  db: { drizzle: { execute: jest.fn(async (_query: SqlFragment) => ({ rows })) } },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, query: Record<string, unknown> = {}) =>
  ({ query, payload }) as unknown as PayloadRequest

const executedParams = (payload: MockPayload): unknown[] => {
  const [call] = payload.db.drizzle.execute.mock.calls
  if (!call) throw new Error('Expected a SQL query to have been executed')
  return call[0].values
}

describe.each<[string, Endpoint, string, Row]>([
  [
    'signalsAgeMetric',
    signalsAgeMetric,
    'Failed to fetch signals age metric',
    {
      bucket: '<1 ден',
      bucket_order: 0,
      count: 3,
      districts: [{ id: 1, name: 'Sredets', count: 3 }],
    },
  ],
  [
    'signalsStatusMetric',
    signalsStatusMetric,
    'Failed to fetch signals status metric',
    {
      status: 'pending',
      count: 5,
      status_order: 0,
      districts: [{ id: 2, name: 'Lozenets', count: 5 }],
    },
  ],
  [
    'signalsActiveContainerStateMetric',
    signalsActiveContainerStateMetric,
    'Failed to fetch active signals by container state metric',
    {
      container_state: 'full',
      count: 4,
      districts: [{ id: 3, name: 'Mladost', count: 4 }],
    },
  ],
])('%s endpoint (unit)', (_name, endpoint, errorMessage, row) => {
  it('defaults objectType to waste-container and returns the rows as data', async () => {
    const payload = makePayload([row])

    const res = await endpoint.handler(makeReq(payload))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [row] })
    expect(executedParams(payload)).toEqual(['waste-container'])
  })

  it('accepts an explicit supported objectType', async () => {
    const payload = makePayload()

    const res = await endpoint.handler(makeReq(payload, { objectType: 'waste-container' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
    expect(executedParams(payload)).toEqual(['waste-container'])
  })

  it('returns 400 for an unsupported objectType without querying the database', async () => {
    const payload = makePayload()

    const res = await endpoint.handler(makeReq(payload, { objectType: 'drinking-fountain' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Invalid object type',
      details: 'objectType must be one of: waste-container',
    })
    expect(payload.db.drizzle.execute).not.toHaveBeenCalled()
  })

  describe('errors', () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('returns 500 with details when the query fails', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockRejectedValue(new Error('db down'))

      const res = await endpoint.handler(makeReq(payload))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: errorMessage, details: 'db down' })
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('reports "Unknown error" when a non-Error is thrown', async () => {
      const payload = makePayload()
      payload.db.drizzle.execute.mockRejectedValue('boom')

      const res = await endpoint.handler(makeReq(payload))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: errorMessage, details: 'Unknown error' })
    })
  })
})
