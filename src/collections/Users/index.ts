import type { CollectionConfig } from 'payload'

import { deleteAccount } from '../../endpoints/deleteAccount'
import { isAdmin } from '@/access/isAdmin'
import { hasAdminPanelAccess } from '@/access/hasAdminPanelAccess'

export const Users: CollectionConfig = {
  slug: 'users',
  endpoints: [deleteAccount],
  access: {
    admin: hasAdminPanelAccess,
    create: () => true,
    delete: isAdmin,
    read: ({ req: { user } }) => {
      // Admins can read all users
      if (user?.role === 'admin') {
        return true
      }
      // Users can only read their own profile
      return {
        id: {
          equals: user?.id,
        },
      }
    },
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
    hidden: ({ user }: { user: unknown }) => (user as { role?: string } | null)?.role !== 'admin',
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
      defaultValue: 'user',
      access: {
        create: isAdmin,
        update: isAdmin,
        read: () => true, // Everyone can see the role field
      },
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
        {
          label: 'Inspector',
          value: 'inspector',
        },
        {
          label: 'Waste Collector',
          value: 'wasteCollector',
        },
      ],
      admin: {
        description: 'User role determines access permissions',
      },
    },
  ],
  timestamps: true,
}
