import type { CollectionConfig } from 'payload'

export const Signals: CollectionConfig = {
  slug: 'signals',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'createdAt'],
    group: 'City Infrastructure',
  },
  access: {
    // Anyone can read and create signals (citizens can report)
    read: () => true,
    create: () => true,
    // Only admins can update/delete
    update: ({ req: { user } }) => Boolean(user),
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
      required: true,
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
      name: 'reporterName',
      label: 'Reporter Name',
      type: 'text',
      admin: {
        description: 'Name of the person reporting (optional)',
      },
    },
    {
      name: 'reporterEmail',
      label: 'Reporter Email',
      type: 'email',
      admin: {
        description: 'Email of the person reporting (optional)',
      },
    },
    {
      name: 'reporterPhone',
      label: 'Reporter Phone',
      type: 'text',
      admin: {
        description: 'Phone number of the person reporting (optional)',
      },
    },
  ],
}
