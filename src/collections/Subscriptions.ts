import type { CollectionConfig, Access } from 'payload'

/**
 * Custom access: anyone can create; only the owner (identified by their push
 * token string) can read or update their own subscription.
 */
const ownerOrAdmin: Access = ({ req }) => {
  if (req.user) return true // admins / authenticated users can always read
  return false
}

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  labels: {
    singular: 'Абонамент',
    plural: 'Абонаменти',
  },
  admin: {
    useAsTitle: 'pushToken',
    defaultColumns: ['pushToken', 'user', 'categories', 'updatedAt'],
    description: 'Push notification subscriptions per device — categories + location filters',
    group: 'Известия',
  },
  access: {
    create: () => true, // anonymous devices can subscribe
    read: ownerOrAdmin,
    update: ownerOrAdmin,
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'pushToken',
      type: 'relationship',
      relationTo: 'push-tokens',
      required: true,
      index: true,
      admin: {
        description: 'The Expo push token that owns this subscription',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: {
        description:
          'Linked user account. Populated on login so preferences can sync across devices.',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        description: 'Categories the subscriber wants to receive notifications for.',
      },
    },
    {
      name: 'locationFilters',
      type: 'array',
      admin: {
        description:
          'Location constraints. Notification is delivered when ANY filter matches the news item location.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'filterType',
          type: 'select',
          required: true,
          defaultValue: 'all',
          options: [
            { label: 'Цяла София (без ограничение)', value: 'all' },
            { label: 'Административен район', value: 'district' },
            { label: 'Точка с радиус', value: 'point' },
            { label: 'Нарисувана зона', value: 'area' },
          ],
          admin: {
            description: 'Type of location filter',
          },
        },
        // district filter
        {
          name: 'district',
          type: 'relationship',
          relationTo: 'city-districts',
          hasMany: false,
          admin: {
            condition: (_, siblingData) => siblingData?.filterType === 'district',
            description: 'Administrative district (shown when filterType = district)',
          },
        },
        // point + radius filter
        {
          name: 'latitude',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.filterType === 'point',
            description: 'Center latitude (shown when filterType = point)',
          },
        },
        {
          name: 'longitude',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.filterType === 'point',
            description: 'Center longitude (shown when filterType = point)',
          },
        },
        {
          name: 'radius',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.filterType === 'point',
            description: 'Radius in metres (shown when filterType = point)',
          },
        },
        // area (GeoJSON polygon) filter
        {
          name: 'polygon',
          type: 'json',
          admin: {
            condition: (_, siblingData) => siblingData?.filterType === 'area',
            description:
              'GeoJSON Polygon geometry: { type: "Polygon", coordinates: [[[lng,lat],...]] }',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
