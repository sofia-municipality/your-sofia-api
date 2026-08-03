import type {
  CollectionBeforeValidateHook,
  CollectionAfterChangeHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'
import { findMissionProfileByUser } from '@/utilities/missionProfiles'

const relId = (value: unknown): string | number | undefined => {
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number | undefined
}

/**
 * On create: auto-sets `verifier` to the authenticated user, blocks a citizen
 * from verifying their own mission, requires the mission to actually be
 * `ready_for_review`, and blocks a duplicate vote from the same verifier
 * (defense in depth alongside the unique index below).
 */
const beforeValidateVerification: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create' || !data) return data
  if (!req.user)
    throw new APIError('Трябва да сте влезли в профила си, за да проверите мисия.', 401)

  const missionId = relId(data.mission)
  if (!missionId) throw new APIError('Не е посочена мисия за проверка.', 400)

  const mission = await req.payload.findByID({
    collection: 'missions',
    id: missionId,
    overrideAccess: true,
  })

  if (!mission) throw new APIError('Мисията не съществува.', 404)
  if (mission.status !== 'ready_for_review') {
    throw new APIError('Мисията не е в статус "За преглед" и не може да бъде проверявана.', 400)
  }

  const citizenId = relId(mission.citizen)
  if (citizenId && String(citizenId) === String(req.user.id)) {
    throw new APIError('Не можете да проверявате собствената си мисия.', 403)
  }

  const existing = await req.payload.find({
    collection: 'mission-verifications',
    where: {
      and: [{ mission: { equals: missionId } }, { verifier: { equals: req.user.id } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    throw new APIError('Вече сте подали проверка за тази мисия.', 409)
  }

  return {
    ...data,
    verifier: req.user.id,
  }
}

/**
 * Recomputes the advisory `communityConsensus` field on the related mission.
 * This is purely informational for the Inspector — it never auto-completes
 * a mission (the Inspector is always the final gate).
 */
const afterChangeRecomputeConsensus: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
  if (operation !== 'create') return doc

  const missionId = relId(doc.mission)
  if (!missionId) return doc

  try {
    const verifications = await req.payload.find({
      collection: 'mission-verifications',
      where: { mission: { equals: missionId } },
      depth: 1,
      limit: 100,
      overrideAccess: true,
    })

    const approvals = verifications.docs.filter((v) => v.decision === 'approve')
    const rejections = verifications.docs.filter((v) => v.decision === 'reject')

    const verifierIds = Array.from(new Set(approvals.map((v) => relId(v.verifier)).filter(Boolean)))
    let trustedApproval = false

    for (const verifierId of verifierIds) {
      const profile = await findMissionProfileByUser(req.payload, verifierId as string | number)
      if (profile?.contributorLevel === 'guardian') {
        trustedApproval = true
        break
      }
    }

    const distinctApprovers = new Set(approvals.map((v) => String(relId(v.verifier))))

    let consensus: 'none' | 'trusted_verified' | 'peer_verified' | 'disputed' = 'none'
    if (trustedApproval) {
      consensus = 'trusted_verified'
    } else if (distinctApprovers.size >= 3) {
      consensus = 'peer_verified'
    } else if (rejections.length > 0) {
      consensus = 'disputed'
    }

    await req.payload.update({
      collection: 'missions',
      id: missionId,
      data: { communityConsensus: consensus },
      overrideAccess: true,
    })
  } catch (err) {
    req.payload.logger.error(
      `[MissionVerifications] Failed to recompute consensus for mission ${missionId}: ${err}`
    )
  }

  return doc
}

export const MissionVerifications: CollectionConfig = {
  slug: 'mission-verifications',
  labels: {
    singular: 'Проверка на мисия',
    plural: 'Проверки на мисии',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['mission', 'verifier', 'decision', 'createdAt'],
    group: 'Градска инфраструктура',
    description:
      'Обществени (peer) проверки на мисии от граждани/доверени проверяващи — само информативни за инспектора',
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  hooks: {
    beforeValidate: [beforeValidateVerification],
    afterChange: [afterChangeRecomputeConsensus],
  },
  access: {
    admin: canViewCityInfrastructure,
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => {
      if (isCityInfrastructureAdmin(user?.role)) return true
      if (!user) return false
      return { or: [{ verifier: { equals: user.id } }, { 'mission.citizen': { equals: user.id } }] }
    },
    update: () => false,
    delete: ({ req: { user } }) => isCityInfrastructureAdmin(user?.role),
  },
  fields: [
    {
      name: 'mission',
      label: 'Мисия',
      type: 'relationship',
      relationTo: 'missions',
      required: true,
      index: true,
    },
    {
      name: 'verifier',
      label: 'Проверяващ',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'decision',
      label: 'Решение',
      type: 'select',
      required: true,
      options: [
        { label: 'Одобрявам', value: 'approve' },
        { label: 'Отхвърлям', value: 'reject' },
      ],
    },
    {
      name: 'comment',
      label: 'Коментар',
      type: 'textarea',
    },
  ],
  indexes: [
    {
      fields: ['mission', 'verifier'],
      unique: true,
    },
  ],
  timestamps: true,
}
