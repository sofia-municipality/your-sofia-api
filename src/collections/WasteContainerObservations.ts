import type { CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  cityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'

export const WasteContainerObservations: CollectionConfig = {
  slug: 'waste-container-observations',
  labels: {
    singular: 'Наблюдение на контейнер',
    plural: 'Наблюдения на контейнери',
  },
  access: {
    admin: canViewCityInfrastructure,
    create: cityInfrastructureAdmin,
    read: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    group: 'Градска инфраструктура',
    defaultColumns: ['container', 'cleanedAt', 'vehicleId', 'cleanedBy', 'collectionCount'],
    description: 'Наблюдения при събиране на отпадъци и почистване',
    hidden: ({ user }) => user?.role === 'wasteCollector' || user?.role === 'fountainAdmin',
  },
  fields: [
    {
      name: 'container',
      label: 'Контейнер',
      type: 'relationship',
      relationTo: 'waste-containers',
      required: true,
    },
    {
      name: 'photo',
      label: 'Снимка',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Снимка на почистения контейнер',
      },
    },
    {
      name: 'cleanedBy',
      label: 'Почистено от',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'Служител, маркирал контейнера като почистен',
      },
    },
    {
      name: 'vehicleId',
      label: 'Идентификатор на превозно средство',
      type: 'number',
      required: false,
      admin: {
        description: 'GPS идентификатор на превозното средство от външната система за проследяване',
      },
    },
    {
      name: 'firmId',
      label: 'Идентификатор на фирма',
      type: 'number',
      required: false,
      admin: {
        description: 'FirmId от външния GPS API',
      },
    },
    {
      name: 'collectionCount',
      label: 'Брой събирания',
      type: 'number',
      min: 1,
      required: false,
      admin: {
        description: 'Брой на събирателните събития, извършени на това място',
      },
    },
    {
      name: 'cleanedAt',
      label: 'Почистено на',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'notes',
      label: 'Бележки',
      type: 'textarea',
    },
  ],
  indexes: [
    {
      fields: ['container', 'cleanedAt'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        if (req.user && !data.cleanedBy) {
          data.cleanedBy = req.user.id
        }
        if (!data.cleanedAt) {
          data.cleanedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
