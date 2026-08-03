import type { CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'

export const DarPointsTransactions: CollectionConfig = {
  slug: 'dar-points-transactions',
  labels: {
    singular: 'Транзакция с дарителски точки',
    plural: 'Транзакции с дарителски точки',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'amount', 'reason', 'mission', 'createdAt'],
    group: 'Градска инфраструктура',
    description: 'Одитен дневник на всички присъдени/коригирани дарителски точки',
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  access: {
    admin: canViewCityInfrastructure,
    // System-only: always written internally via `overrideAccess: true` from
    // the Missions afterChange hook (or manually by an admin script). Never
    // creatable directly by a client request — prevents a citizen forging
    // their own point-award history.
    create: () => false,
    read: ({ req: { user } }) => {
      if (isCityInfrastructureAdmin(user?.role)) return true
      if (!user) return false
      return { user: { equals: user.id } }
    },
    update: () => false,
    delete: ({ req: { user } }) => isCityInfrastructureAdmin(user?.role),
  },
  fields: [
    {
      name: 'idempotencyKey',
      label: 'Ключ за идемпотентност',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          'Системен ключ за гарантиране, че присъждането на точки за една мисия става само веднъж',
      },
    },
    {
      name: 'user',
      label: 'Потребител',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'amount',
      label: 'Брой точки',
      type: 'number',
      required: true,
    },
    {
      name: 'reason',
      label: 'Причина',
      type: 'select',
      required: true,
      defaultValue: 'mission_completed',
      options: [
        { label: 'Завършена мисия', value: 'mission_completed' },
        { label: 'Връщане за подобрение', value: 'mission_returned' },
        { label: 'Ръчна корекция', value: 'manual_adjustment' },
      ],
    },
    {
      name: 'mission',
      label: 'Мисия',
      type: 'relationship',
      relationTo: 'missions',
      admin: {
        description: 'Свързаната мисия (ако точките са от завършена мисия)',
      },
    },
  ],
  timestamps: true,
}
