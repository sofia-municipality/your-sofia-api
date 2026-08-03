import type { Endpoint } from 'payload'

const relId = (value: unknown): string | number | undefined => {
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number | undefined
}

/**
 * POST /api/missions/:id/submit-task
 * body: { taskId: string, beforePhotoId?: number, afterPhotoId?: number }
 *
 * Citizen attaches before/after photo(s) to a specific task row and marks it
 * complete. Only the mission's assigned citizen may call this, and only
 * while the mission is being actively worked on.
 */
export const submitMissionTask: Endpoint = {
  path: '/:id/submit-task',
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

    let body: { taskId?: unknown; beforePhotoId?: unknown; afterPhotoId?: unknown }
    try {
      if (typeof req.json !== 'function') {
        return Response.json({ error: 'Invalid request' }, { status: 400 })
      }
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { taskId, beforePhotoId, afterPhotoId } = body
    if (typeof taskId !== 'string') {
      return Response.json({ error: 'taskId is required' }, { status: 400 })
    }
    if (!beforePhotoId && !afterPhotoId) {
      return Response.json(
        { error: 'At least one of beforePhotoId/afterPhotoId is required' },
        { status: 400 }
      )
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
      const taskIndex = tasks.findIndex((t) => t.id === taskId)
      if (taskIndex === -1) {
        return Response.json({ error: 'Task not found on this mission' }, { status: 404 })
      }

      const updatedTasks = tasks.map((task, index) => {
        if (index !== taskIndex) return task
        return {
          ...task,
          ...(beforePhotoId ? { beforePhoto: beforePhotoId } : {}),
          ...(afterPhotoId ? { afterPhoto: afterPhotoId } : {}),
          completedByCitizenAt: new Date().toISOString(),
        }
      })

      const updated = await payload.update({
        collection: 'missions',
        id: id as string,
        data: { tasks: updatedTasks },
        overrideAccess: true,
      })

      return Response.json({ success: true, mission: updated })
    } catch (error) {
      payload.logger.error(`[Missions] Failed to submit task for mission ${id}: ${error}`)
      return Response.json({ error: 'Failed to submit task' }, { status: 500 })
    }
  },
}
