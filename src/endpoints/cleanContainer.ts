import type { Endpoint } from 'payload'

export const cleanContainer: Endpoint = {
  path: '/:id/clean',
  method: 'post',
  handler: async (req) => {
    const { payload, user } = req
    const id = req.routeParams?.id

    // Check if user is authenticated
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has containerAdmin or admin role
    const userRole = (user as any).role
    if (userRole !== 'containerAdmin' && userRole !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Only Container Admins can clean containers' },
        { status: 403 }
      )
    }

    if (!id) {
      return Response.json({ error: 'Container ID is required' }, { status: 400 })
    }

    try {
      // Find the container
      const container = await payload.findByID({
        collection: 'waste-containers',
        id: parseInt(id as string),
      })

      if (!container) {
        return Response.json({ error: 'Container not found' }, { status: 404 })
      }

      // Find all active signals for this container
      const signals = await payload.find({
        collection: 'signals',
        where: {
          and: [
            {
              'cityObject.referenceId': {
                equals: container.publicNumber,
              },
            },
            {
              category: {
                equals: 'waste-container',
              },
            },
            {
              status: {
                not_in: ['resolved', 'rejected'],
              },
            },
          ],
        },
      })

      // Update all active signals to resolved
      const updatePromises = signals.docs.map((signal: any) =>
        payload.update({
          collection: 'signals',
          id: signal.id,
          data: {
            status: 'resolved',
            adminNotes: `Container cleaned by ${(user as any).name || (user as any).email} on ${new Date().toISOString()}`,
          },
        })
      )

      await Promise.all(updatePromises)

      // Update container status to active and set lastCleaned timestamp
      const updatedContainer = await payload.update({
        collection: 'waste-containers',
        id: parseInt(id as string),
        data: {
          status: 'active',
          lastCleaned: new Date().toISOString(),
        },
      })

      payload.logger.info(
        `Container ${container.publicNumber} cleaned by ${(user as any).email}. Resolved ${signals.docs.length} signals.`
      )

      return Response.json(
        {
          success: true,
          container: updatedContainer,
          resolvedSignals: signals.docs.length,
        },
        { status: 200 }
      )
    } catch (error) {
      payload.logger.error(`Error cleaning container ${id}:`, error)
      return Response.json({ error: 'Failed to clean container' }, { status: 500 })
    }
  },
}
