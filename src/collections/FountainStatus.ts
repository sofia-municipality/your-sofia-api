import type { Access, CollectionConfig } from 'payload'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'

const canEdit: Access = ({ req: { user } }) => canManageFountains(user?.role)

export const FountainStatus: CollectionConfig = {
  slug: 'fountain-status',
  labels: {
    singular: 'Състояние на чешма',
    plural: 'Състояния на чешми',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Градска инфраструктура',
    description: 'Възможни състояния/статуси на чешмите (напр. Добро състояние, За ремонт)',
    hidden: ({ user }) => !canViewFountains({ req: { user } } as any),
  },
  access: {
    admin: canViewFountains,
    read: () => true,
    create: canEdit,
    update: canEdit,
    delete: canEdit,
  },
  defaultSort: 'name',
  fields: [
    {
      name: 'name',
      label: 'Наименование',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Уникално наименование на състоянието',
      },
    },
  ],
}
