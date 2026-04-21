import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { adminOnly } from '@/access/adminOnly'

export const PushTokens: CollectionConfig = {
  slug: 'push-tokens',
  admin: {
    useAsTitle: 'token',
    group: 'City Infrastructure',
    defaultColumns: ['token', 'device', 'createdAt'],
    description: 'Expo push notification tokens from mobile devices',
    hidden: adminOnly,
  },
  access: {
    // Only admin role can access the admin panel
    admin: isAdmin,
    // Anyone can create (register device)
    create: () => true,
    // Only admins can read/update/delete
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Expo Push Token (e.g., ExponentPushToken[...])',
      },
    },
    {
      name: 'device',
      type: 'select',
      required: true,
      options: [
        {
          label: 'iOS',
          value: 'ios',
        },
        {
          label: 'Android',
          value: 'android',
        },
      ],
      admin: {
        description: 'Device platform',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this token should receive notifications',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: {
        description: 'Linked user account (optional — anonymous tokens have no user)',
      },
    },
    {
      name: 'reporterUniqueId',
      type: 'text',
      index: true,
      admin: {
        description: 'Anonymous device identifier — links push token to signal reports',
        position: 'sidebar',
      },
    },
    {
      name: 'lastUsed',
      type: 'date',
      admin: {
        description: 'Last time this token was verified',
      },
    },
  ],
  timestamps: true,
}
