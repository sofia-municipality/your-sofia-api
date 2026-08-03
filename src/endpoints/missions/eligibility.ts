import type { Payload } from 'payload'

export type MissionLevel = 'good-first-mission' | 'verified-contributor' | 'verified-guardian'

export interface EligibilityContext {
  completedMissionsCount: number
  guardianApproved: boolean
}

// A citizen unlocks "verified-contributor" missions after completing this many.
export const CONTRIBUTOR_THRESHOLD = 3

export const computeEligibility = (level: string, ctx: EligibilityContext): boolean => {
  switch (level as MissionLevel) {
    case 'good-first-mission':
      return true
    case 'verified-contributor':
      return ctx.completedMissionsCount >= CONTRIBUTOR_THRESHOLD
    case 'verified-guardian':
      return ctx.guardianApproved
    default:
      return false
  }
}

export const unlockRequirementLabel = (level: string): string => {
  switch (level as MissionLevel) {
    case 'verified-contributor':
      return `Изисква ${CONTRIBUTOR_THRESHOLD} завършени мисии`
    case 'verified-guardian':
      return 'Изисква статус "Доверен проверяващ"'
    default:
      return ''
  }
}

export const getCompletedMissionsCount = async (
  payload: Payload,
  userId: string | number
): Promise<number> => {
  const result = await payload.find({
    collection: 'missions',
    where: {
      and: [{ citizen: { equals: userId } }, { status: { equals: 'completed' } }],
    },
    limit: 0,
    overrideAccess: true,
  })
  return result.totalDocs
}
