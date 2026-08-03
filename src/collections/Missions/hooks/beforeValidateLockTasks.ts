import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

const TASKS_LOCKED_ERROR =
  'Задачите не могат да бъдат добавяни, премахвани или пренареждани след като мисията е публикувана.'

// Once a citizen may have already started submitting before/after photos
// against specific task rows, the Inspector must not restructure the task
// list — only edit the text of existing rows.
const LOCKED_STATUSES = new Set([
  'in_progress',
  'ready_for_review',
  'returned_for_improvement',
  'completed',
])

export const beforeValidateLockTasks: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  const traceStart = Date.now()
  req.payload.logger.info(
    `[MissionsTrace][beforeValidateLockTasks] start op=${operation} mission=${String(originalDoc?.id ?? data?.id ?? 'unknown')} hasIncomingTasks=${Boolean(data?.tasks)}`
  )

  if (operation !== 'update' || !originalDoc || !data?.tasks) {
    req.payload.logger.info(
      `[MissionsTrace][beforeValidateLockTasks] skip reason=non-update-or-missing-data elapsedMs=${Date.now() - traceStart}`
    )
    return data
  }

  const status = originalDoc.status as string | undefined
  if (!status || !LOCKED_STATUSES.has(status)) {
    req.payload.logger.info(
      `[MissionsTrace][beforeValidateLockTasks] skip reason=status-not-locked status=${status ?? 'none'} elapsedMs=${Date.now() - traceStart}`
    )
    return data
  }

  const originalIds = ((originalDoc.tasks ?? []) as Array<{ id?: string }>).map((t) => t.id)
  const incomingIds = ((data.tasks ?? []) as Array<{ id?: string }>).map((t) => t.id)

  const structureChanged =
    originalIds.length !== incomingIds.length ||
    originalIds.some((id, index) => id !== incomingIds[index])

  req.payload.logger.info(
    `[MissionsTrace][beforeValidateLockTasks] compare originalCount=${originalIds.length} incomingCount=${incomingIds.length} changed=${structureChanged} elapsedMs=${Date.now() - traceStart}`
  )

  if (structureChanged) {
    req.payload.logger.info(
      `[MissionsTrace][beforeValidateLockTasks] reject reason=tasks-structure-changed elapsedMs=${Date.now() - traceStart}`
    )
    throw new APIError(TASKS_LOCKED_ERROR, 400)
  }

  req.payload.logger.info(
    `[MissionsTrace][beforeValidateLockTasks] pass elapsedMs=${Date.now() - traceStart}`
  )

  return data
}
