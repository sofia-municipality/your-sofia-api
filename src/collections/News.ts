import type { CollectionConfig } from 'payload'
import { sendNewsNotification } from '../utilities/pushNotifications'

export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'topic', 'publishedAt', 'status'],
  },
  access: {
    // Only admin role can access the admin panel
    admin: ({ req: { user } }) => user?.role === 'admin',
    // Anyone can read published news
    read: ({ req: { user } }) => {
      if (user) return true // Admins can see all
      return {
        status: {
          equals: 'published',
        },
      }
    },
    // Only admins can create/update/delete
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true, // Bulgarian & English
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
    },
    {
      name: 'topic',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Festivals',
          value: 'festivals',
        },
        {
          label: 'Street Closure',
          value: 'street-closure',
        },
        {
          label: 'City Events',
          value: 'city-events',
        },
        {
          label: 'Alerts',
          value: 'alerts',
        },
      ],
      defaultValue: 'city-events',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: false,
        },
        {
          name: 'longitude',
          type: 'number',
          required: false,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
      ],
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData.status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'pushNotification',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Send push notification when published',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // Send push notification if enabled and status is published
        if (doc.status === 'published' && doc.pushNotification) {
          try {
            req.payload.logger.info(`Sending push notification for news: ${doc.title}`)

            await sendNewsNotification(req.payload, doc.id, doc.title, doc.description)

            req.payload.logger.info(`Push notification sent successfully for news: ${doc.title}`)
          } catch (error) {
            req.payload.logger.error(`Failed to send push notification: ${error}`)
          }
        }
      },
    ],
  },
  timestamps: true,
}
