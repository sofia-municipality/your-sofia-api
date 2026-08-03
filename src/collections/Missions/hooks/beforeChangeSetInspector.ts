import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Automatically sets the `inspector` relationship to the authenticated
 * (city-infrastructure) user who created the mission.
 */
export const beforeChangeSetInspector: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  const traceStart = Date.now()
  req.payload.logger.info(
    `[MissionsTrace][beforeChangeSetInspector] start op=${operation} hasInspector=${Boolean(data?.inspector)} user=${req.user?.id ?? 'none'}`
  )

  if (operation === 'create' && req.user && !data.inspector) {
    const nextData = {
      ...data,
      inspector: req.user.id,
    }

    req.payload.logger.info(
      `[MissionsTrace][beforeChangeSetInspector] set inspector=${req.user.id} elapsedMs=${Date.now() - traceStart}`
    )

    return nextData
  }

  req.payload.logger.info(
    `[MissionsTrace][beforeChangeSetInspector] skip elapsedMs=${Date.now() - traceStart}`
  )

  return data
}
