import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'
import { randomUUID } from 'crypto'
import { calculateDistance } from '@/utilities/mapUtils'

export const beforeValidateSignal: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  // Only run on create operation
  if (operation !== 'create' || !data) return data

  // Signals must be pinned: require a location or an existing object reference
  const hasLocation = Boolean(
    Array.isArray(data.location) &&
      data.location.length === 2 &&
      data.location[0] != null &&
      data.location[1] != null
  )
  const hasObjectRef = Boolean(data.cityObject?.referenceId)
  if (!hasLocation && !hasObjectRef) {
    req.payload.logger.warn(
      `Signal rejected: no location and no cityObject.referenceId provided (reporter: ${data.reporterUniqueId || 'unknown'})`
    )
    throw new APIError('Signal must have a location or an assigned city object.', 400)
  }

  // Check for proximity restriction for non-admin users
  if (
    data.category === 'waste-container' &&
    data.cityObject?.referenceId &&
    data.location &&
    Array.isArray(data.location)
  ) {
    // Check if user is admin (skip proximity check for admins)
    const isAdminUser = req.user?.role === 'admin'

    if (!isAdminUser) {
      try {
        const [signalLng, signalLat] = data.location

        // Find the container by publicNumber
        const containers = await req.payload.find({
          collection: 'waste-containers',
          where: {
            publicNumber: {
              equals: data.cityObject.referenceId,
            },
          },
          limit: 1,
        })

        if (containers.docs.length > 0) {
          const container = containers.docs[0]
          // Point field stores coordinates as [longitude, latitude]
          if (container && container.location && Array.isArray(container.location)) {
            const [containerLng, containerLat] = container.location
            const distance = calculateDistance(signalLat, signalLng, containerLat, containerLng)

            // Check if user is within 30 meters
            if (distance > 30) {
              req.payload.logger.warn(
                `Signal rejected: User is ${Math.round(distance)}m away from container ${data.cityObject.referenceId} (max 30m allowed)`
              )

              throw new APIError(
                `You must be within 30 meters of the container to report a signal. Current distance: ${Math.round(distance)}m`,
                403
              )
            }
          }
        }
      } catch (error) {
        // If it's our custom APIError, re-throw it
        if (error instanceof APIError) {
          throw error
        }
        // For other errors, log and continue (fail-open)
        req.payload.logger.error(`Error checking proximity: ${error}`)
      }
    }
  }

  // Auto-create waste container if referenceId is empty for waste-container signals
  //TODO: Don't create duplicates if there is a container within X meters already
  if (
    data.category === 'waste-container' &&
    data.cityObject?.type === 'waste-container' &&
    !data.cityObject?.referenceId &&
    data.location &&
    Array.isArray(data.location)
  ) {
    try {
      // Generate a unique public number based on UUID
      const publicNumber = `SOF-WASTE-${randomUUID()}`

      // Create a new waste container
      const newContainer = await req.payload.create({
        collection: 'waste-containers',
        data: {
          publicNumber,
          status: 'active',
          source: 'community',
          wasteType: 'general',
          capacitySize: 'standard',
          capacityVolume: 3,
          // Point field format: [longitude, latitude]
          location: data.location as [number, number],
          address: data.address,
          notes: `Auto-created from signal. ${data.cityObject.name || 'New container'}`,
        },
        draft: false,
      })

      // Update the signal data with the new container reference
      data.cityObject.referenceId = publicNumber

      req.payload.logger.info(
        `Auto-created waste container ${publicNumber} (ID: ${newContainer.id}) from signal`
      )
    } catch (error) {
      req.payload.logger.error(`Failed to auto-create waste container: ${error}`)
      // Re-throw error to fail signal creation
      throw new APIError(
        `Failed to create new waste container: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      )
    }
  }

  // Daily rate limit: max 10 signals per reporterUniqueId per calendar day (admins exempt)
  if (data.reporterUniqueId && req.user?.role !== 'admin') {
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const todayCount = await req.payload.find({
        collection: 'signals',
        overrideAccess: true,
        where: {
          and: [
            {
              reporterUniqueId: {
                equals: data.reporterUniqueId,
              },
            },
            {
              createdAt: {
                greater_than_equal: startOfDay.toISOString(),
              },
            },
          ],
        },
        limit: 0, // count only
      })

      if (todayCount.totalDocs >= 10) {
        req.payload.logger.warn(
          `Daily limit reached: Reporter ${data.reporterUniqueId} has ${todayCount.totalDocs} signals today`
        )
        throw new APIError(
          `Daily signal limit reached. You can submit up to 10 signals per day.`,
          429
        )
      }
    } catch (error) {
      if (error instanceof APIError) throw error
      req.payload.logger.error(`Error checking daily signal limit: ${error}`)
    }
  }

  // Check for duplicate waste container signals
  if (
    data.category === 'waste-container' &&
    data.reporterUniqueId &&
    data.cityObject?.referenceId
  ) {
    try {
      // Find existing active signals from same reporter for same container
      const existingSignals = await req.payload.find({
        collection: 'signals',
        overrideAccess: true,
        where: {
          and: [
            {
              reporterUniqueId: {
                equals: data.reporterUniqueId,
              },
            },
            {
              'cityObject.referenceId': {
                equals: data.cityObject.referenceId,
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
        limit: 1,
      })

      if (existingSignals.docs.length > 0) {
        const existingSignal = existingSignals.docs[0]
        if (existingSignal) {
          req.payload.logger.warn(
            `Duplicate signal attempt: Reporter ${data.reporterUniqueId} already has active signal #${existingSignal.id} for container ${data.cityObject.referenceId}`
          )

          throw new APIError(
            `Signal for same object already exists. Signal ID: ${existingSignal.id}`,
            403
          )
        }
      }
    } catch (error) {
      // If it's our custom APIError, re-throw it
      if (error instanceof APIError) {
        throw error
      }
      // For other errors, log and continue (fail-open)
      req.payload.logger.error(`Error checking for duplicate signals: ${error}`)
    }
  }

  return data
}
