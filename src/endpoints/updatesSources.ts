import type { Endpoint } from 'payload'
import { proxyUpdatesUpstreamGet } from './updatesProxyUtils'

export const updatesSources: Endpoint = {
  path: '/updates/sources',
  method: 'get',
  handler: async (req) => {
    return proxyUpdatesUpstreamGet('/sources', req.query as Record<string, unknown> | undefined, {
      logger: req.payload?.logger,
    })
  },
}
