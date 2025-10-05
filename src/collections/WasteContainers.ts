import type { CollectionConfig } from 'payload'

export const WasteContainers: CollectionConfig = {
  slug: 'waste-containers',
  admin: {
    useAsTitle: 'publicNumber',
    defaultColumns: ['publicNumber', 'location', 'capacitySize', 'servicedBy'],
    group: 'City Infrastructure',
  },
  access: {
    // Anyone can read waste container data
    read: () => true,
    // Only admins can create/update/delete
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'publicNumber',
      label: 'Public Container Number',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique identifier visible to citizens (e.g., SOF-001, WC-123)',
      },
    },
    {
      name: 'image',
      label: 'Container Image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Photo of the waste container',
      },
    },
    {
      name: 'location',
      type: 'group',
      label: 'Location on Map',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: true,
          min: -90,
          max: 90,
          admin: {
            description: 'Latitude coordinate (e.g., 42.6977 for Sofia)',
          },
        },
        {
          name: 'longitude',
          type: 'number',
          required: true,
          min: -180,
          max: 180,
          admin: {
            description: 'Longitude coordinate (e.g., 23.3219 for Sofia)',
          },
        },
        {
          name: 'address',
          type: 'text',
          admin: {
            description: 'Human-readable address (optional)',
          },
        },
      ],
    },
    {
      name: 'capacityVolume',
      label: 'Capacity (cubic meters)',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Container capacity in cubic meters (m³)',
      },
    },
    {
      name: 'capacitySize',
      label: 'Relative Capacity Size',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Tiny (< 0.5 m³)',
          value: 'tiny',
        },
        {
          label: 'Small (0.5 - 1 m³)',
          value: 'small',
        },
        {
          label: 'Standard (1 - 3 m³)',
          value: 'standard',
        },
        {
          label: 'Big (3 - 5 m³)',
          value: 'big',
        },
        {
          label: 'Industrial (> 5 m³)',
          value: 'industrial',
        },
      ],
      defaultValue: 'standard',
      admin: {
        description: 'Relative size classification for easy filtering',
      },
    },
    {
      name: 'serviceInterval',
      label: 'Service Interval',
      type: 'text',
      required: false,
      admin: {
        description: 'How often the container is serviced (e.g., "Daily", "Every Monday and Thursday", "Twice a week")',
      },
    },
    {
      name: 'servicedBy',
      label: 'Serviced By',
      type: 'text',
      required: false,
      admin: {
        description: 'Name of the company or service responsible for collection',
      },
    },
    {
      name: 'wasteType',
      label: 'Waste Type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'General Waste',
          value: 'general',
        },
        {
          label: 'Recyclables',
          value: 'recyclables',
        },
        {
          label: 'Organic/Compost',
          value: 'organic',
        },
        {
          label: 'Glass',
          value: 'glass',
        },
        {
          label: 'Paper/Cardboard',
          value: 'paper',
        },
        {
          label: 'Plastic',
          value: 'plastic',
        },
        {
          label: 'Metal',
          value: 'metal',
        },
      ],
      defaultValue: 'general',
      admin: {
        description: 'Type of waste this container accepts',
      },
    },
    {
      name: 'status',
      label: 'Container Status',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Active',
          value: 'active',
        },
        {
          label: 'Full',
          value: 'full',
        },
        {
          label: 'Maintenance',
          value: 'maintenance',
        },
        {
          label: 'Inactive',
          value: 'inactive',
        },
      ],
      defaultValue: 'active',
    },
    {
      name: 'notes',
      label: 'Additional Notes',
      type: 'textarea',
      admin: {
        description: 'Any additional information about this container',
      },
    },
  ],
}
