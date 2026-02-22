import type { Endpoint } from 'payload'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

export const updatesById: Endpoint = {
  path: '/updates/by-id',
  method: 'get',
  handler: async (req) => {
    const id = req.query?.id

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return Response.json({ error: 'Missing required query parameter: id' }, { status: 400 })
    }

    const sanitizedId = id.trim()

    const upstreamQuery = {
      ...(req.query as Record<string, unknown> | undefined),
      id: sanitizedId,
    }

    return proxyUpdatesUpstreamGet('/messages/by-id', upstreamQuery, {
      logger: req.payload?.logger,
    })
  },
}
