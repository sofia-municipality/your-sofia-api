import type { Endpoint } from 'payload'
import type { User } from '@/payload-types'
import { isCityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'

export const bulkUpdateContainerStatus: Endpoint = {
  path: '/bulk-status',
  method: 'patch',
  handler: async (req) => {
    const { payload, user } = req

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (user as User).role
    if (!isCityInfrastructureAdmin(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { ids?: unknown; status?: unknown }
    try {
      if (typeof req.json !== 'function') {
        return Response.json({ error: 'Invalid request' }, { status: 400 })
      }
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { ids, status } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 })
    }

    const validStatuses = ['active', 'full', 'maintenance', 'inactive', 'pending']
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return Response.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const numericIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

    if (numericIds.length === 0) {
      return Response.json({ error: 'No valid numeric ids provided' }, { status: 400 })
    }

    try {
      const result = await payload.update({
        collection: 'waste-containers',
        where: {
          id: { in: numericIds },
        },
        data: { status: status as 'active' | 'full' | 'maintenance' | 'inactive' | 'pending' },
      })

      return Response.json({
        success: true,
        updated: result.docs.length,
        ids: result.docs.map((c) => c.id),
      })
    } catch (error) {
      console.error('Bulk status update error:', error)
      return Response.json(
        {
          error: 'Failed to update containers',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}
