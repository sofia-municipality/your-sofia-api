import type { Endpoint } from 'payload'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

function getTodayStartIso(): string {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  return dayStart.toISOString()
}

function withDefaultTimespanEndGte(query?: Record<string, unknown>): Record<string, unknown> {
  const upstreamQuery = { ...(query ?? {}) }

  if (upstreamQuery.timespanEndGte === undefined || upstreamQuery.timespanEndGte === null) {
    upstreamQuery.timespanEndGte = getTodayStartIso()
  }

  return upstreamQuery
}

export const updates: Endpoint = {
  path: '/updates',
  method: 'get',
  handler: async (req) => {
    return proxyUpdatesUpstreamGet(
      '/messages',
      withDefaultTimespanEndGte(req.query as Record<string, unknown> | undefined),
      {
        logger: req.payload?.logger,
      }
    )
  },
}
