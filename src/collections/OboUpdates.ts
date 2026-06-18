import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'

/**
 * Local cache of OboApp "Updates" (city messages).
 *
 * The full public message is stored verbatim in the `data` JSONB field; the
 * remaining columns exist purely to make the read query fast and indexable
 * (locality + timespan cutoff) and to support upsert/prune (`oboId`) and the
 * notification look-back (`finalizedAt`).
 *
 * Rows are written exclusively by the `syncOboUpdates` task (with
 * `overrideAccess: true`) and read by the public `/api/updates` endpoints.
 * The admin panel exposes it read-only for inspection/debugging.
 */
export const OboUpdates: CollectionConfig = {
  slug: 'obo-updates',
  labels: { singular: 'OBO ъпдейт', plural: 'OBO ъпдейти' },
  admin: {
    useAsTitle: 'oboId',
    defaultColumns: ['oboId', 'locality', 'timespanEnd', 'finalizedAt', 'updatedAt'],
    // Internal sync cache — never shown in the admin UI. The data is served
    // exclusively through the custom Updates API endpoints.
    hidden: true,
  },
  timestamps: true,
  access: {
    admin: isAdmin,
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'oboId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Идентификатор на съобщението в OboApp (за upsert и търсене по id).' },
    },
    {
      name: 'locality',
      type: 'text',
      index: true,
      admin: { description: 'Населено място (напр. bg.sofia).' },
    },
    {
      name: 'timespanEnd',
      type: 'date',
      index: true,
      admin: { description: 'Край на валидността — използва се за филтъра „активни“.' },
    },
    {
      name: 'finalizedAt',
      type: 'date',
      index: true,
      admin: { description: 'Кога съобщението е финализирано — за подредба и известия.' },
    },
    {
      name: 'data',
      type: 'json',
      required: true,
      admin: { description: 'Пълното публично съобщение (UpdateMessage), сервира се както е.' },
    },
  ],
}
