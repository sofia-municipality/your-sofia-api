import type { Endpoint } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { IgrantApiError, IgrantConfigError, listCredentialDefinitions } from '@/lib/igrant'

/**
 * Admin-only sanity check for the iGrant.io integration — confirms
 * IGRANT_API_BASE_URL / IGRANT_API_KEY are configured and accepted by
 * iGrant, without issuing or touching any real credential data.
 *
 * See IMPLEMENTATION_PLAN.md (your-sofia-mobile), Epic 10, Stage 1/2.
 */
export const igrantTestConnection: Endpoint = {
  path: '/igrant/test-connection',
  method: 'get',
  handler: async (req) => {
    if (!req.user || !isAdmin({ req })) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const result = await listCredentialDefinitions({ limit: 1, skipCounts: true })

      return Response.json({
        ok: true,
        message: 'iGrant API key and base URL are valid.',
        credentialDefinitionsCount:
          result.pagination?.totalItems ?? result.credentialDefinition?.length ?? 0,
      })
    } catch (error) {
      if (error instanceof IgrantConfigError) {
        return Response.json({ ok: false, error: error.message }, { status: 500 })
      }

      if (error instanceof IgrantApiError) {
        req.payload?.logger?.error(
          { status: error.status, body: error.body },
          '[igrantTestConnection] iGrant API rejected the request'
        )
        return Response.json(
          {
            ok: false,
            error: error.message,
            igrantStatus: error.status,
            igrantBody: error.body,
          },
          { status: 502 }
        )
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      req.payload?.logger?.error({ err: error }, '[igrantTestConnection] Unexpected error')
      return Response.json({ ok: false, error: message }, { status: 500 })
    }
  },
}
