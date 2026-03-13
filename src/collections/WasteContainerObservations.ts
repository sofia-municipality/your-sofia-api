import type { CollectionConfig } from 'payload'

export const WasteContainerObservations: CollectionConfig = {
  slug: 'waste-container-observations',
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  admin: {
    group: 'City Infrastructure',
    defaultColumns: ['container', 'cleanedAt', 'vehicleId', 'cleanedBy', 'collectionCount'],
  },
  fields: [
    {
      name: 'container',
      type: 'relationship',
      relationTo: 'waste-containers',
      required: true,
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Photo of the cleaned container',
      },
    },
    {
      name: 'cleanedBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'Staff member who marked the container clean',
      },
    },
    {
      name: 'vehicleId',
      label: 'Vehicle ID',
      type: 'number',
      required: false,
      admin: {
        description: 'GPS VehicleId from the external fleet tracking system',
      },
    },
    {
      name: 'firmId',
      label: 'Firm ID',
      type: 'number',
      required: false,
      admin: {
        description: 'FirmId from the external GPS API',
      },
    },
    {
      name: 'collectionCount',
      label: 'Collection Event Count',
      type: 'number',
      min: 1,
      required: false,
      admin: {
        description: 'Number of shooter events performed at this spot',
      },
    },
    {
      name: 'cleanedAt',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  indexes: [
    {
      fields: ['container', 'cleanedAt'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        if (req.user && !data.cleanedBy) {
          data.cleanedBy = req.user.id
        }
        if (!data.cleanedAt) {
          data.cleanedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
