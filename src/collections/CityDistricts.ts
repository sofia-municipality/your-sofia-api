import type { CollectionConfig } from 'payload'
import { canViewCityInfrastructure } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'

export const CityDistricts: CollectionConfig = {
  slug: 'city-districts',
  labels: {
    singular: 'Административен район',
    plural: 'Административни райони',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['districtId', 'name', 'wasteCollectionZone'],
    group: 'Градска инфраструктура',
    description: 'Административни райони на София (1–24)',
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: 'districtId',
  fields: [
    {
      name: 'districtId',
      label: 'Номер на район',
      type: 'number',
      required: true,
      unique: true,
      min: 1,
      max: 24,
      index: true,
      admin: {
        description: 'Цифров идентификатор на района (1–24)',
      },
    },
    {
      name: 'name',
      label: 'Наименование на района',
      type: 'text',
      required: true,
      admin: {
        description: 'Наименование на административния район на София',
      },
    },
    {
      name: 'code',
      label: 'Код на района',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      minLength: 3,
      maxLength: 3,
      admin: {
        description:
          'Тризначен код: R + първите две букви, или R + инициали за многоименни райони (напр. RKP за Красна поляна)',
      },
    },
    {
      name: 'wasteCollectionZone',
      label: 'Зона за събиране на отпадъци',
      type: 'relationship',
      relationTo: 'waste-collection-zones',
      required: false,
      admin: {
        description: 'Зоната за събиране на отпадъци, към която принадлежи районът',
      },
    },
  ],
}
