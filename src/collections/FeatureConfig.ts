import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'

export const FeatureConfig: CollectionConfig = {
  slug: 'feature-config',
  labels: {
    singular: 'Конфигурация на функционалност',
    plural: 'Конфигурации на функционалности',
  },
  admin: {
    useAsTitle: 'feature',
    defaultColumns: ['feature', 'enabled', 'description'],
    group: 'Системни настройки',
    description: 'Включване/изключване на функционалности на системата',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'feature',
      label: 'Функционалност',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Уникално име на функционалността (напр. enable_container_creation_on_collection)',
      },
    },
    {
      name: 'enabled',
      label: 'Включена',
      type: 'checkbox',
      defaultValue: false,
      required: true,
    },
    {
      name: 'description',
      label: 'Описание',
      type: 'textarea',
      admin: {
        description: 'Кратко описание на какво прави тази функционалност',
      },
    },
  ],
}
