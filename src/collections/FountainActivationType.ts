import type { Access, CollectionConfig } from 'payload'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'

const canEdit: Access = ({ req: { user } }) => canManageFountains(user?.role)

export const FountainActivationType: CollectionConfig = {
  slug: 'fountain-activation-type',
  labels: {
    singular: 'Начин на активиране',
    plural: 'Начини на активиране',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Градска инфраструктура',
    description: 'Механизъм за пускане на водата (напр. Бутон, Кран, Канелка, Няма)',
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
        description: 'Уникално наименование на начина на активиране',
      },
    },
  ],
}
