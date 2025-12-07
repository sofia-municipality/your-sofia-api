import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => {
      // Only admin role can access the admin panel
      return user?.role === 'admin'
    },
    create: authenticated,
    delete: ({ req: { user } }) => {
      // Only admins can delete users
      return user?.role === 'admin'
    },
    read: authenticated,
    update: ({ req: { user } }) => {
      // Admins can edit all users, users can edit themselves
      if (user?.role === 'admin') {
        return true
      }
      // Users can only edit their own profile
      return {
        id: {
          equals: user?.id,
        },
      }
    },
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: {
    //verify: process.env.NODE_ENV === 'production',
    tokenExpiration: 60 * 60 * 24, // 24h in secconds
    maxLoginAttempts: 5, // the admin can unlock manually
    lockTime: 1000 * 60 * 10, // 10 minutes in milliseconds
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        {
          label: 'User',
          value: 'user',
        },
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Container Admin',
          value: 'containerAdmin',
        },
      ],
      admin: {
        description: 'User role determines access permissions',
      },
    },
  ],
  timestamps: true,
}
