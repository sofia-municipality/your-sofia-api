import type { Access, CollectionConfig } from 'payload'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'

const canEdit: Access = ({ req: { user } }) => canManageFountains(user?.role)

export const FountainOwner: CollectionConfig = {
  slug: 'fountain-owner',
  labels: {
    singular: 'Собственик/поддръжка',
    plural: 'Собственици/поддръжка',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Градска инфраструктура',
    description: 'Собственик или отговорник за поддръжката на чешмата (напр. район, ОППГГ)',
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
        description: 'Уникално наименование на собственика/поддръжката',
      },
    },
    {
      name: 'contactEmail',
      label: 'Имейл за контакт',
      type: 'text',
      required: false,
      admin: {
        description: 'Уникален имейл за контакт със собственика/поддръжката',
      },
    },
  ],
}
