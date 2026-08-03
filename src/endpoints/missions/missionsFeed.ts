import type { Endpoint } from 'payload'
import {
  computeEligibility,
  getCompletedMissionsCount,
  unlockRequirementLabel,
} from './eligibility'
import { getMissionProfileSummary } from '@/utilities/missionProfiles'

/**
 * GET /api/missions/feed
 *
 * Returns the citizen's quest board: all `open` missions plus their own
 * missions in any status, each annotated with `locked`/`unlockRequirement`
 * computed server-side (never trust a client-side level check).
 */
export const missionsFeed: Endpoint = {
  path: '/feed',
  method: 'get',
  handler: async (req) => {
    const { payload, user } = req

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const profile = await getMissionProfileSummary(payload, user.id)
      const guardianApproved = profile.contributorLevel === 'guardian'
      const completedMissionsCount = await getCompletedMissionsCount(payload, user.id)

      const result = await payload.find({
        collection: 'missions',
        where: {
          or: [{ status: { equals: 'open' } }, { citizen: { equals: user.id } }],
        },
        depth: 1,
        limit: 100,
        sort: '-createdAt',
        overrideAccess: true,
      })

      const missions = result.docs.map((mission) => {
        const eligible = computeEligibility(mission.level as string, {
          completedMissionsCount,
          guardianApproved,
        })
        const isOwn =
          mission.citizen &&
          String(typeof mission.citizen === 'object' ? mission.citizen.id : mission.citizen) ===
            String(user.id)

        return {
          ...mission,
          locked: mission.status === 'open' && !eligible && !isOwn,
          unlockRequirement: eligible ? '' : unlockRequirementLabel(mission.level as string),
        }
      })

      return Response.json({
        missions,
        completedMissionsCount,
        contributorLevel: profile.contributorLevel,
      })
    } catch (error) {
      payload.logger.error(`[Missions] Failed to load feed: ${error}`)
      return Response.json({ error: 'Failed to load missions feed' }, { status: 500 })
    }
  },
}
