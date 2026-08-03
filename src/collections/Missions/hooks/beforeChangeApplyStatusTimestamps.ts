import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Auto-sets the timestamp/points fields tied to a mission's status transitions,
 * regardless of whether the transition came from the Payload Admin UI (Inspector)
 * or a validated mobile endpoint (`overrideAccess: true` update).
 *
 * `pointsAwarded` is set here (not in an afterChange hook) so the value lands in
 * the very same write — this avoids needing a second recursive `payload.update`
 * call on the Missions collection just to persist it.
 */
export const beforeChangeApplyStatusTimestamps: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  const traceStart = Date.now()
  req.payload.logger.info(
    `[MissionsTrace][beforeChangeApplyStatusTimestamps] start op=${operation} mission=${String(originalDoc?.id ?? data?.id ?? 'unknown')}`
  )

  if (operation !== 'update' || !originalDoc || !data) {
    req.payload.logger.info(
      `[MissionsTrace][beforeChangeApplyStatusTimestamps] skip reason=non-update-or-missing-doc elapsedMs=${Date.now() - traceStart}`
    )
    return data
  }

  const prevStatus = originalDoc.status as string | undefined
  const nextStatus = (data.status as string | undefined) ?? prevStatus

  req.payload.logger.info(
    `[MissionsTrace][beforeChangeApplyStatusTimestamps] transition prev=${prevStatus ?? 'none'} next=${nextStatus ?? 'none'}`
  )

  if (!nextStatus || prevStatus === nextStatus) {
    req.payload.logger.info(
      `[MissionsTrace][beforeChangeApplyStatusTimestamps] skip reason=no-transition elapsedMs=${Date.now() - traceStart}`
    )
    return data
  }

  const now = new Date().toISOString()

  if (nextStatus === 'in_progress' && !originalDoc.claimedAt && !data.claimedAt) {
    data.claimedAt = now
  }

  if (nextStatus === 'ready_for_review') {
    data.submittedForReviewAt = now
  }

  if (nextStatus === 'returned_for_improvement' || nextStatus === 'completed') {
    data.reviewedAt = now
  }

  if (nextStatus === 'completed') {
    data.completedAt = now
    if (!originalDoc.pointsAwarded && !data.pointsAwarded) {
      data.pointsAwarded = data.pointsReward ?? originalDoc.pointsReward
    }
  }

  req.payload.logger.info(
    `[MissionsTrace][beforeChangeApplyStatusTimestamps] done reviewedAt=${Boolean(data.reviewedAt)} completedAt=${Boolean(data.completedAt)} pointsAwarded=${String(data.pointsAwarded ?? 'none')} elapsedMs=${Date.now() - traceStart}`
  )

  return data
}
