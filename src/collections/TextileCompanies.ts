import type { Access, CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'

const canEditTextileCompanies: Access = ({ req: { user } }) => isCityInfrastructureAdmin(user?.role)

export const TextileCompanies: CollectionConfig = {
  slug: 'textile-companies',
  labels: {
    singular: 'Фирма за текстил',
    plural: 'Фирми за текстил',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'email'],
    group: 'Градска инфраструктура',
    description: 'Фирми, обслужващи контейнерите за текстил',
    listSearchableFields: ['name', 'phone', 'email'],
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: canEditTextileCompanies,
    update: canEditTextileCompanies,
    delete: canEditTextileCompanies,
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
        description: 'Наименование на фирмата (напр. texcycle, evrotex, m-tex)',
      },
    },
    {
      name: 'phone',
      label: 'Телефон',
      type: 'text',
      required: false,
      admin: {
        description: 'Телефон за контакт (по избор)',
      },
    },
    {
      name: 'email',
      label: 'Имейл',
      type: 'email',
      required: false,
      admin: {
        description: 'Имейл за контакт (по избор)',
      },
    },
  ],
}
