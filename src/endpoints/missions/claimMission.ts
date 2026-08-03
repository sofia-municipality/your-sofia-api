import type { Endpoint } from 'payload'
import { computeEligibility, getCompletedMissionsCount } from './eligibility'
import { getMissionProfileSummary } from '@/utilities/missionProfiles'

/**
 * POST /api/missions/:id/claim
 *
 * Citizen claims an `open` mission from the quest board. Eligibility is
 * re-validated server-side regardless of what the mobile client displayed.
 */
export const claimMission: Endpoint = {
  path: '/:id/claim',
  method: 'post',
  handler: async (req) => {
    const { payload, user } = req
    const id = req.routeParams?.id

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!id) {
      return Response.json({ error: 'Mission id is required' }, { status: 400 })
    }

    try {
      const mission = await payload.findByID({
        collection: 'missions',
        id: id as string,
        overrideAccess: true,
      })

      if (!mission) {
        return Response.json({ error: 'Mission not found' }, { status: 404 })
      }

      if (mission.status !== 'open') {
        return Response.json({ error: 'Mission is not available to claim' }, { status: 409 })
      }

      const profile = await getMissionProfileSummary(payload, user.id)
      const guardianApproved = profile.contributorLevel === 'guardian'
      const completedMissionsCount = await getCompletedMissionsCount(payload, user.id)
      const eligible = computeEligibility(mission.level as string, {
        completedMissionsCount,
        guardianApproved,
      })

      if (!eligible) {
        return Response.json(
          { error: 'You have not unlocked this mission level yet' },
          { status: 403 }
        )
      }

      const updated = await payload.update({
        collection: 'missions',
        id: id as string,
        data: {
          citizen: user.id,
          status: 'in_progress',
        },
        overrideAccess: true,
      })

      return Response.json({ success: true, mission: updated })
    } catch (error) {
      payload.logger.error(`[Missions] Failed to claim mission ${id}: ${error}`)
      return Response.json({ error: 'Failed to claim mission' }, { status: 500 })
    }
  },
}
