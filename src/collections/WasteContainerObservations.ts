import type { CollectionConfig } from 'payload'

export const WasteContainerObservations: CollectionConfig = {
  slug: 'waste-container-observations',
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  admin: { group: 'City Infrastructure' },
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
      required: true,
    },
    {
      name: 'cleanedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
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
