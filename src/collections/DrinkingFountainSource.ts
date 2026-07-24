import type { Access, CollectionConfig } from 'payload'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'

const canEdit: Access = ({ req: { user } }) => canManageFountains(user?.role)

export const DrinkingFountainSource: CollectionConfig = {
  slug: 'drinking-fountain-source',
  labels: {
    singular: 'Произход на водата',
    plural: 'Произход на водата',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Градска инфраструктура',
    description: 'Източник на водата за чешмите (напр. Софийска вода, Минерална, Изворна)',
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
        description: 'Уникално наименование на източника на вода',
      },
    },
  ],
}
