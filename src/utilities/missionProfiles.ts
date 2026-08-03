import type { Payload } from 'payload'

const DEFAULT_DAR_POINTS = 0

const normalizeDarPoints = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_DAR_POINTS
}

const normalizeUserId = (userId: number | string): number => {
  if (typeof userId === 'number') return userId
  const parsed = Number(userId)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid user id for mission profile: ${String(userId)}`)
  }
  return parsed
}

export async function findMissionProfileByUser(
  payload: Payload,
  userId: number | string
): Promise<{
  id: number | string
  user: number | string
  darPoints: number
  contributorLevel: string
} | null> {
  const existing = await payload.find({
    collection: 'mission-profiles',
    where: {
      user: {
        equals: userId,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (!existing.docs[0]) return null

  const profile = existing.docs[0] as {
    id: number | string
    user: number | string
    darPoints?: number | null
    contributorLevel?: string | null
  }

  return {
    id: profile.id,
    user: profile.user,
    darPoints: normalizeDarPoints(profile.darPoints),
    contributorLevel: profile.contributorLevel || 'beginner',
  }
}

export async function getOrCreateMissionProfile(
  payload: Payload,
  userId: number | string
): Promise<{
  id: number | string
  user: number | string
  darPoints: number
  contributorLevel: string
}> {
  const normalizedUserId = normalizeUserId(userId)
  const existing = await findMissionProfileByUser(payload, userId)
  if (existing) return existing

  try {
    const created = (await payload.create({
      collection: 'mission-profiles',
      data: {
        user: normalizedUserId,
        darPoints: DEFAULT_DAR_POINTS,
        contributorLevel: 'beginner',
      },
      overrideAccess: true,
    })) as {
      id: number | string
      user: number | string
      darPoints?: number | null
      contributorLevel?: string | null
    }

    return {
      id: created.id,
      user: created.user,
      darPoints: normalizeDarPoints(created.darPoints),
      contributorLevel: created.contributorLevel || 'beginner',
    }
  } catch (error) {
    // In case of a race where another request created the profile first.
    const profile = await findMissionProfileByUser(payload, userId)
    if (profile) return profile
    throw error
  }
}

export async function getMissionProfileSummary(
  payload: Payload,
  userId: number | string
): Promise<{
  darPoints: number
  contributorLevel: 'beginner' | 'contributor' | 'guardian'
}> {
  const profile = await getOrCreateMissionProfile(payload, userId)
  return {
    darPoints: profile.darPoints,
    contributorLevel: profile.contributorLevel as 'beginner' | 'contributor' | 'guardian',
  }
}
