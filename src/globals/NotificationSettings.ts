import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'

export const NotificationSettings: GlobalConfig = {
  slug: 'notification-settings',
  label: 'Notification Settings',
  admin: {
    group: 'Settings',
    description: 'Internal settings for the push notification tasks',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      name: 'lastUpdatesNotifiedAt',
      label: 'Last updates notification sent at',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Timestamp of the last time the updates notification task ran. Used to find new updates since the last run.',
        readOnly: true,
      },
    },
  ],
}
