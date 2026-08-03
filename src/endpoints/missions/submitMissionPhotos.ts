import type { Endpoint } from 'payload'

const relId = (value: unknown): string | number | undefined => {
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number | undefined
}

const idsOf = (value: unknown): (string | number)[] => {
  if (!Array.isArray(value)) return []
  return value.map((v) => relId(v)).filter((v): v is string | number => v !== undefined)
}

/**
 * POST /api/missions/:id/photos
 * body: { beforePhotoIds?: number[], afterPhotoIds?: number[] }
 *
 * Appends overall mission-level before/after photos (uploaded separately to
 * `/api/media`). Only the mission's assigned citizen may call this, and only
 * while the mission is being actively worked on.
 */
export const submitMissionPhotos: Endpoint = {
  path: '/:id/photos',
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

    let body: { beforePhotoIds?: unknown; afterPhotoIds?: unknown }
    try {
      if (typeof req.json !== 'function') {
        return Response.json({ error: 'Invalid request' }, { status: 400 })
      }
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const beforePhotoIds = Array.isArray(body.beforePhotoIds) ? body.beforePhotoIds : []
    const afterPhotoIds = Array.isArray(body.afterPhotoIds) ? body.afterPhotoIds : []

    if (beforePhotoIds.length === 0 && afterPhotoIds.length === 0) {
      return Response.json(
        { error: 'At least one of beforePhotoIds/afterPhotoIds is required' },
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

      const updated = await payload.update({
        collection: 'missions',
        id: id as string,
        data: {
          missionBeforePhotos: [...idsOf(mission.missionBeforePhotos), ...beforePhotoIds],
          missionAfterPhotos: [...idsOf(mission.missionAfterPhotos), ...afterPhotoIds],
        },
        overrideAccess: true,
      })

      return Response.json({ success: true, mission: updated })
    } catch (error) {
      payload.logger.error(`[Missions] Failed to submit photos for mission ${id}: ${error}`)
      return Response.json({ error: 'Failed to submit mission photos' }, { status: 500 })
    }
  },
}
