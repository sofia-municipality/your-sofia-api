import type { Access, CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'

const canEditZones: Access = ({ req: { user } }) => isCityInfrastructureAdmin(user?.role)

export const WasteCollectionZones: CollectionConfig = {
  slug: 'waste-collection-zones',
  labels: {
    singular: 'Зона за събиране на отпадъци',
    plural: 'Зони за събиране на отпадъци',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['number', 'name', 'serviceCompanyId'],
    group: 'Градска инфраструктура',
    description: 'Карта на зоните за събиране към административните райони и обслужващите фирми',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: canEditZones,
    update: canEditZones,
    delete: canEditZones,
  },
  defaultSort: 'number',
  fields: [
    {
      name: 'number',
      label: 'Номер на зоната',
      type: 'number',
      required: true,
      unique: true,
      min: 1,
      max: 10,
      admin: {
        description: 'Номер на зоната 1–10',
      },
    },
    {
      name: 'name',
      label: 'Наименование на зоната',
      type: 'text',
      required: true,
      admin: {
        description: 'Показвано наименование (напр. "Зона 1")',
      },
    },
    {
      name: 'serviceCompanyId',
      label: 'Идентификатор на фирмата',
      type: 'number',
      required: false,
      admin: {
        description: 'Цифров идентификатор на фирмата, отговорна за тази зона',
      },
    },
  ],
}
