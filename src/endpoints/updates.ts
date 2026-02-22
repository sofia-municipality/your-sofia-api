import type { Endpoint } from 'payload'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

export const updates: Endpoint = {
  path: '/updates',
  method: 'get',
  handler: async (req) => {
    return proxyUpdatesUpstreamGet('/messages', req.query as Record<string, unknown> | undefined, {
      logger: req.payload?.logger,
    })
  },
}
