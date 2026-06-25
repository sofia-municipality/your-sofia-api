import type { CollectionConfig } from 'payload'

import { APIError } from 'payload'
import { deleteAccount } from '../../endpoints/deleteAccount'
import { resendVerificationEmail } from '../../endpoints/resendVerificationEmail'
import { isAdmin } from '@/access/isAdmin'
import { hasAdminPanelAccess } from '@/access/hasAdminPanelAccess'
import { adminOnly } from '@/access/adminOnly'
import { getServerSideURL } from '@/utilities/getURL'

export const Users: CollectionConfig = {
  slug: 'users',
  endpoints: [deleteAccount, resendVerificationEmail],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if ((operation === 'create' || data?.password) && typeof data?.password === 'string') {
          const p = data.password
          if (p.length < 6) throw new APIError('Password must be at least 6 characters.', 400)
          if (!/[a-z]/.test(p)) throw new APIError('Password must contain a lowercase letter.', 400)
          if (!/[A-Z]/.test(p))
            throw new APIError('Password must contain an uppercase letter.', 400)
          if (!/[0-9]/.test(p)) throw new APIError('Password must contain a digit.', 400)
          if (!/[^a-zA-Z0-9]/.test(p))
            throw new APIError('Password must contain a special character.', 400)
        }
        return data
      },
    ],
    beforeLogin: [
      ({ user }) => {
        if (user._verified !== true) {
          throw new APIError(
            'Your email address has not been verified. Please check your inbox.',
            403
          )
        }
      },
    ],
  },
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
    hidden: adminOnly,
  },
  auth: {
    verify: {
      generateEmailHTML: ({ token }: { token: string }) => {
        const verifyURL = `${getServerSideURL()}/verify-email?token=${token}`
        console.log(`[Users] Email verification URL: ${verifyURL}`)
        return `
          <p>Здравейте,</p>
          <p>Моля, потвърдете имейл адреса си, за да активирате профила си в <strong>Твоята София</strong>.</p>
          <p><a href="${verifyURL}" style="display:inline-block;padding:12px 24px;background:#2F54C5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Потвърди имейл</a></p>
          <p>Ако бутонът не работи, копирайте и поставете следния адрес в браузъра си:</p>
          <p><a href="${verifyURL}">${verifyURL}</a></p>
          <p>Ако не сте се регистрирали, игнорирайте този имейл.</p>
          <p>Поздрави,<br /><strong>Твоята София @ Столична община</strong></p>
          
          <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
          <p>Hello,</p>
          <p>Please verify your email address to activate your <strong>Your Sofia</strong> account.</p>
          <p><a href="${verifyURL}" style="display:inline-block;padding:12px 24px;background:#2F54C5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Verify email</a></p>
          <p>If the button doesn't work, copy and paste the following link into your browser:</p>
          <p><a href="${verifyURL}">${verifyURL}</a></p>
          <p>If you did not submit a registration, please ignore this email.</p>
          <p>Best regards,<br /><strong>Your Sofia @ Sofia Municipality</strong></p>
        `
      },
    },
    tokenExpiration: 60 * 60 * 24, // 24h in seconds
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
