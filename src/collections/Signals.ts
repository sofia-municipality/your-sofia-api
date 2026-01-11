import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { randomUUID } from 'crypto'

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export const Signals: CollectionConfig = {
  slug: 'signals',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'createdAt'],
    group: 'City Infrastructure',
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        // Only run on create operation
        if (operation !== 'create' || !data) return data

        // Check for proximity restriction for non-admin users
        if (
          data.category === 'waste-container' &&
          data.cityObject?.referenceId &&
          data.location?.latitude &&
          data.location?.longitude
        ) {
          // Check if user is admin (skip proximity check for admins)
          const isAdmin = req.user?.role === 'admin'

          if (!isAdmin) {
            try {
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
                if (
                  container &&
                  container.location?.latitude &&
                  container.location?.longitude
                ) {
                  const distance = calculateDistance(
                    data.location.latitude,
                    data.location.longitude,
                    container.location.latitude,
                    container.location.longitude
                  )

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
              req.payload.logger.error(
                `Error checking proximity: ${error}`
              )
            }
          }
        }

        // Auto-create waste container if referenceId is empty for waste-container signals
        //TODO: Don't create duplicates if there is a container within X meters already
        if (
          data.category === 'waste-container' &&
          data.cityObject?.type === 'waste-container' &&
          !data.cityObject?.referenceId &&
          data.location?.latitude &&
          data.location?.longitude
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
                source : 'community',
                wasteType: 'general',
                capacitySize: 'standard',
                capacityVolume: 3,
                location: {
                  latitude: data.location.latitude,
                  longitude: data.location.longitude,
                  address: data.location.address,
                },
                notes: `Auto-created from signal. ${data.cityObject.name || 'New container'}`,
              },
              draft: false
            })

            // Update the signal data with the new container reference
            data.cityObject.referenceId = publicNumber

            req.payload.logger.info(
              `Auto-created waste container ${publicNumber} (ID: ${newContainer.id}) from signal`
            )
          } catch (error) {
            req.payload.logger.error(
              `Failed to auto-create waste container: ${error}`
            )
            // Re-throw error to fail signal creation
            throw new APIError(
              `Failed to create new waste container: ${error instanceof Error ? error.message : 'Unknown error'}`,
              500
            )
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
            req.payload.logger.error(
              `Error checking for duplicate signals: ${error}`
            )
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // Only run on create operation
        if (operation !== 'create') return doc

        // Check if this is a waste container signal
        if (
          doc.category === 'waste-container' &&
          doc.cityObject?.type === 'waste-container' &&
          doc.cityObject?.referenceId
        ) {
          try {
            // Find the container by publicNumber
            const containers = await req.payload.find({
              collection: 'waste-containers',
              where: {
                publicNumber: {
                  equals: doc.cityObject.referenceId,
                },
              },
              limit: 1,
            })

            if (containers.docs.length > 0 && containers.docs[0]) {
              const container = containers.docs[0]
              const updateData: any = {}
              
              // Update container status to "full" if signal reports it as full
              if (Array.isArray(doc.containerState) && doc.containerState.includes('full')) {
                if (container.status !== 'full') {
                  updateData.status = 'full'
                }
              }

              // Update container state field with new states from signal
              if (Array.isArray(doc.containerState) && doc.containerState.length > 0) {
                // Get existing states or empty array
                const existingStates = Array.isArray(container.state) ? container.state : []
                
                // Merge states (add new ones, remove duplicates)
                const mergedStates = [...new Set([...existingStates, ...doc.containerState])]
                
                updateData.state = mergedStates
              }

              // Only update if there's something to update
              if (Object.keys(updateData).length > 0) {
                await req.payload.update({
                  collection: 'waste-containers',
                  id: container.id,
                  data: updateData,
                })

                req.payload.logger.info(
                  `Container ${doc.cityObject.referenceId} updated due to signal ${doc.id}. Changes: ${JSON.stringify(updateData)}`
                )
              }
            }
          } catch (error) {
            req.payload.logger.error(
              `Failed to update container for signal ${doc.id}: ${error}`
            )
          }
        }

        return doc
      },
    ],
  },
  access: {
    // Only admin role can access the admin panel
    admin: ({ req: { user } }) => user?.role === 'admin',
    // Anyone can read and create signals (citizens can report)
    read: () => true,
    create: () => true,
    // Update: Allow if user is admin OR if reporterUniqueId matches
    update: async ({ req, data, id }) => {
      // Admins can always update
      if (req.user) return true;

      // For non-admin updates, verify reporterUniqueId
      if (data && data.reporterUniqueId && id) {
        try {
          // Fetch the existing signal
          const existingSignal = await req.payload.findByID({
            collection: 'signals',
            id: id.toString(),
          });

          // Check if the reporterUniqueId matches
          if (existingSignal.reporterUniqueId === data.reporterUniqueId) {
            return true;
          }
        } catch (error) {
          req.payload.logger.error(`Error verifying reporterUniqueId: ${error}`);
          return false;
        }
      }

      return false;
    },
    // Only admins can delete
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      localized: true,
      admin: {
        description: 'Brief description of the signal',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: false,
      localized: true,
      admin: {
        description: 'Detailed description of the problem',
      },
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Waste Container Issue',
          value: 'waste-container',
        },
        {
          label: 'Street Damage',
          value: 'street-damage',
        },
        {
          label: 'Lighting',
          value: 'lighting',
        },
        {
          label: 'Green Spaces',
          value: 'green-spaces',
        },
        {
          label: 'Parking',
          value: 'parking',
        },
        {
          label: 'Public Transport',
          value: 'public-transport',
        },
        {
          label: 'Other',
          value: 'other',
        },
      ],
      defaultValue: 'other',
    },
    {
      name: 'cityObject',
      label: 'Related City Object',
      type: 'group',
      admin: {
        description: 'Reference to a related city object (e.g., waste container)',
      },
      fields: [
        {
          name: 'type',
          label: 'Object Type',
          type: 'select',
          options: [
            {
              label: 'Waste Container',
              value: 'waste-container',
            },
            {
              label: 'Street',
              value: 'street',
            },
            {
              label: 'Park',
              value: 'park',
            },
            {
              label: 'Building',
              value: 'building',
            },
            {
              label: 'Other',
              value: 'other',
            },
          ],
        },
        {
          name: 'referenceId',
          label: 'Object ID',
          type: 'text',
          admin: {
            description: 'ID or reference number of the related object',
          },
        },
        {
          name: 'name',
          label: 'Object Name',
          type: 'text',
          admin: {
            description: 'Name or description of the related object',
          },
        },
      ],
    },
    {
      name: 'containerState',
      label: 'Container State',
      type: 'select',
      hasMany: true,
      admin: {
        description: 'State of the waste container (only for waste container signals)',
        condition: (data, siblingData) => {
          return data?.category === 'waste-container' || data?.cityObject?.type === 'waste-container'
        },
      },
      options: [
        {
          label: 'Full',
          value: 'full',
        },
        {
          label: 'Dirty',
          value: 'dirty',
        },
        {
          label: 'Damaged',
          value: 'damaged',
        },
        {
          label: 'Empty',
          value: 'empty',
        },
        {
          label: 'Maintenance',
          value: 'maintenance',
        },
        {
          label: 'For Collection',
          value: 'forCollection',
        },
        {
          label: 'Fallen',
          value: 'fallen',
        },
        {
          label: 'Bulky Waste',
          value: 'bulkyWaste',
        },
      ],
    },
    {
      name: 'location',
      type: 'group',
      label: 'Location',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: false,
          min: -90,
          max: 90,
          admin: {
            description: 'Latitude coordinate',
          },
        },
        {
          name: 'longitude',
          type: 'number',
          required: false,
          min: -180,
          max: 180,
          admin: {
            description: 'Longitude coordinate',
          },
        },
        {
          name: 'address',
          type: 'text',
          admin: {
            description: 'Human-readable address',
          },
        },
      ],
    },
    {
      name: 'images',
      label: 'Images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Photos of the problem',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'In Progress',
          value: 'in-progress',
        },
        {
          label: 'Resolved',
          value: 'resolved',
        },
        {
          label: 'Rejected',
          value: 'rejected',
        },
      ],
      admin: {
        description: 'Current status of the signal',
      },
    },
    {
      name: 'adminNotes',
      label: 'Admin Notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes from administrators',
        condition: (data, siblingData, { user }) => Boolean(user),
      },
    },
    {
      name: 'reporterUniqueId',
      label: 'Reporter Unique ID',
      type: 'text',
      admin: {
        description: 'Unique anonymous identifier of the reporter (for follow-up)',
      },
    },
  ],
}
