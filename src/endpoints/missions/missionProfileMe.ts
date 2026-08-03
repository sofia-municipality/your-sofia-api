import type { Endpoint } from 'payload'
import { getMissionProfileSummary } from '@/utilities/missionProfiles'

export const missionProfileMe: Endpoint = {
  path: '/me',
  method: 'get',
  handler: async (req) => {
    const { payload, user } = req

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const profile = await getMissionProfileSummary(payload, user.id)
      return Response.json(profile)
    } catch (error) {
      payload.logger.error(`[MissionProfiles] Failed to load /me for user ${user.id}: ${error}`)
      return Response.json({ error: 'Failed to load mission profile' }, { status: 500 })
    }
  },
}
