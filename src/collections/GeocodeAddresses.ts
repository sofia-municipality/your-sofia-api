import type { CollectionConfig } from 'payload'
import { locationMapField } from '@/fields/locationMap'
import { cityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'

export const GeocodeAddresses: CollectionConfig = {
  slug: 'geocode-addresses',
  labels: { singular: 'Геокодиран адрес', plural: 'Геокодирани адреси' },
  admin: {
    useAsTitle: 'address',
    defaultColumns: ['address', 'districtHint', 'location', 'updatedAt'],
    group: 'Градска инфраструктура',
    description:
      'Кеш за геокодиране на адреси. Липсващи координати = Nominatim API не е върнал резултати.',
  },
  timestamps: true,
  access: {
    admin: cityInfrastructureAdmin,
    read: cityInfrastructureAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'address',
      label: 'Улица и номер',
      type: 'text',
      required: true,
      admin: { description: 'Нормализиран уличен адрес (без префикс за тип улица)' },
    },
    {
      name: 'districtHint',
      label: 'Район',
      type: 'text',
      required: true,
      admin: { description: 'Код на района, подаден към Nominatim (напр. TRIADICA)' },
    },
    {
      name: 'location',
      label: 'Координати',
      type: 'point',
      admin: { description: 'Координати — липсващи означава, че адресът не е намерен' },
    },
    {
      type: 'collapsible',
      label: 'Карта',
      fields: [locationMapField],
    },
  ],
}
