import type { CollectionAfterChangeHook } from 'payload'
import { getOrCreateMissionProfile } from '@/utilities/missionProfiles'

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { message?: unknown; code?: unknown }
  const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : ''
  const code = typeof maybeError.code === 'string' ? maybeError.code : ''

  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    message.includes('idempotencykey')
  )
}

const getTransitionKey = (
  missionId: string | number,
  citizenId: string | number,
  transition: 'completed' | 'returned',
  transitionTimestamp: string | number
): string => {
  return `mission-${transition}:${String(missionId)}:${String(citizenId)}:${String(transitionTimestamp)}`
}

type MissionDocument = {
  id: string | number
  pointsAwarded?: number | null
  pointsReward?: number | null
  citizen?: { id?: string | number } | string | number
  reviewedAt?: string | null
  completedAt?: string | null
}

const getPointsForTransaction = (doc: MissionDocument): number => {
  return typeof doc.pointsAwarded === 'number'
    ? doc.pointsAwarded
    : typeof doc.pointsReward === 'number'
      ? doc.pointsReward
      : 0
}

/**
 * Adjusts the citizen's `darPoints` balance and writes an audit ledger row
 * whenever a mission transitions into `completed` or is moved from `completed`
 * back to `returned_for_improvement`.
 *
 * This targets the `mission-profiles` and `dar-points-transactions` collections
 * (not `missions`), so it never recurses back into this same afterChange hook.
 */
export const afterChangeCreditDarPoints: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  const traceStart = Date.now()
  req.payload.logger.info(
    `[MissionsTrace][afterChangeCreditDarPoints] start op=${operation} mission=${String(doc.id)} prev=${String(previousDoc?.status ?? 'none')} next=${String(doc.status)}`
  )

  if (operation !== 'update') {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeCreditDarPoints] skip reason=non-update elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const justCompleted = previousDoc?.status !== 'completed' && doc.status === 'completed'
  const justReturned =
    previousDoc?.status === 'completed' && doc.status === 'returned_for_improvement'
  const pointsToAdjust = getPointsForTransaction(doc)
  if (!((justCompleted || justReturned) && pointsToAdjust > 0 && doc.citizen)) {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeCreditDarPoints] skip reason=not-eligible justCompleted=${justCompleted} justReturned=${justReturned} points=${pointsToAdjust} hasCitizen=${Boolean(doc.citizen)} elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const citizenId = typeof doc.citizen === 'object' ? doc.citizen?.id : doc.citizen
  if (!citizenId) {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeCreditDarPoints] skip reason=missing-citizen-id elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const transition = justReturned ? 'returned' : 'completed'
  const transactionAmount = justReturned ? -pointsToAdjust : pointsToAdjust
  const transactionReason = justReturned ? 'mission_returned' : 'mission_completed'
  const transitionTimestamp = justReturned
    ? (doc.reviewedAt ?? Date.now())
    : (doc.completedAt ?? Date.now())
  const idempotencyKey = getTransitionKey(doc.id, citizenId, transition, transitionTimestamp)

  req.payload.logger.info(
    `[MissionsTrace][afterChangeCreditDarPoints] queued citizen=${citizenId} transition=${transition} points=${transactionAmount} key=${idempotencyKey} elapsedMs=${Date.now() - traceStart}`
  )

  // Keep mission save snappy in Admin UI: run downstream accounting writes
  // asynchronously so network/DB hiccups there cannot block status updates.
  void (async () => {
    const asyncStart = Date.now()
    try {
      req.payload.logger.info(
        `[MissionsTrace][afterChangeCreditDarPoints] async-start mission=${String(doc.id)} citizen=${citizenId} transition=${transition} key=${idempotencyKey}`
      )

      try {
        await req.payload.create({
          collection: 'dar-points-transactions',
          data: {
            idempotencyKey,
            user: citizenId,
            amount: transactionAmount,
            reason: transactionReason,
            mission: doc.id,
          },
          overrideAccess: true,
        })

        req.payload.logger.info(
          `[MissionsTrace][afterChangeCreditDarPoints] created-transaction mission=${String(doc.id)} transition=${transition} key=${idempotencyKey} elapsedMs=${Date.now() - asyncStart}`
        )
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          req.payload.logger.info(
            `[MissionsTrace][afterChangeCreditDarPoints] skip reason=already-processed mission=${String(doc.id)} transition=${transition} key=${idempotencyKey} elapsedMs=${Date.now() - asyncStart}`
          )
          return
        }

        throw error
      }

      const profile = await getOrCreateMissionProfile(req.payload, citizenId)

      req.payload.logger.info(
        `[MissionsTrace][afterChangeCreditDarPoints] loaded-profile citizen=${citizenId} profile=${String(profile.id)} elapsedMs=${Date.now() - asyncStart}`
      )

      const currentBalance = profile.darPoints
      const newBalance = currentBalance + transactionAmount

      await req.payload.update({
        collection: 'mission-profiles',
        id: profile.id,
        data: {
          darPoints: newBalance,
        },
        overrideAccess: true,
      })

      req.payload.logger.info(
        `[MissionsTrace][afterChangeCreditDarPoints] updated-profile citizen=${citizenId} profile=${String(profile.id)} newBalance=${newBalance} elapsedMs=${Date.now() - asyncStart}`
      )

      const action = justReturned ? 'debited' : 'credited'
      req.payload.logger.info(
        `[Missions] ${action} ${Math.abs(transactionAmount)} darPoints to user ${citizenId} for mission ${doc.id} (traceElapsedMs=${Date.now() - asyncStart})`
      )
    } catch (err) {
      req.payload.logger.error(
        `[MissionsTrace][afterChangeCreditDarPoints] failed mission=${String(doc.id)} citizen=${citizenId} transition=${transition} elapsedMs=${Date.now() - asyncStart} error=${err}`
      )
    }
  })()

  req.payload.logger.info(
    `[MissionsTrace][afterChangeCreditDarPoints] return-doc elapsedMs=${Date.now() - traceStart}`
  )

  return doc
}
