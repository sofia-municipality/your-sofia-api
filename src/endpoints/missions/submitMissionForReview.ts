import type { Endpoint } from 'payload'

const relId = (value: unknown): string | number | undefined => {
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number | undefined
}

/**
 * POST /api/missions/:id/submit-for-review
 *
 * Citizen marks the whole mission "ready for review" once all required
 * task photos and mission-level before/after photos are present.
 */
export const submitMissionForReview: Endpoint = {
  path: '/:id/submit-for-review',
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

      const citizenId = relId(mission.citizen)
      if (!citizenId || String(citizenId) !== String(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (!['in_progress', 'returned_for_improvement'].includes(mission.status as string)) {
        return Response.json(
          { error: 'Mission is not currently in an editable state' },
          { status: 409 }
        )
      }

      const tasks = (mission.tasks ?? []) as Array<Record<string, unknown>>
      const missingTask = tasks.find((task) => {
        const needsBefore = task.requiresBeforePhoto !== false && !task.beforePhoto
        const needsAfter = task.requiresAfterPhoto !== false && !task.afterPhoto
        return needsBefore || needsAfter
      })
      if (missingTask) {
        return Response.json(
          { error: 'All required task photos must be submitted before review' },
          { status: 400 }
        )
      }

      const beforePhotos = (mission.missionBeforePhotos ?? []) as unknown[]
      const afterPhotos = (mission.missionAfterPhotos ?? []) as unknown[]
      if (beforePhotos.length === 0 || afterPhotos.length === 0) {
        return Response.json(
          { error: 'Overall mission before/after photos are required before review' },
          { status: 400 }
        )
      }

      const updated = await payload.update({
        collection: 'missions',
        id: id as string,
        data: { status: 'ready_for_review' },
        overrideAccess: true,
      })

      return Response.json({ success: true, mission: updated })
    } catch (error) {
      payload.logger.error(`[Missions] Failed to submit mission ${id} for review: ${error}`)
      return Response.json({ error: 'Failed to submit mission for review' }, { status: 500 })
    }
  },
}
