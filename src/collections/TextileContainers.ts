import type { Access, CollectionConfig } from 'payload'
import { locationMapField } from '@/fields/locationMap'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'
import { textileContainersMapData } from '@/endpoints/textileContainersMapData'

/**
 * Condition states a textile container can be in. Shared with the `textileState`
 * field on Signals so a citizen report and the container record speak the same
 * vocabulary.
 */
export const TEXTILE_STATUS_OPTIONS = [
  { label: 'Пълен', value: 'full' },
  { label: 'Развален', value: 'damaged' },
  { label: 'Отворен', value: 'open' },
] as const

const canEditTextileContainers: Access = ({ req: { user } }) =>
  isCityInfrastructureAdmin(user?.role)

export const TextileContainers: CollectionConfig = {
  slug: 'textile-containers',
  labels: {
    singular: 'Контейнер за текстил',
    plural: 'Контейнери за текстил',
  },
  endpoints: [textileContainersMapData],
  admin: {
    useAsTitle: 'address',
    defaultColumns: ['number', 'address', 'district', 'company', 'status'],
    group: 'Градска инфраструктура',
    description: 'Контейнери за събиране на текстил',
    listSearchableFields: ['address'],
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: canEditTextileContainers,
    update: canEditTextileContainers,
    delete: canEditTextileContainers,
  },
  defaultSort: 'id',
  fields: [
    // ── Sidebar fields ────────────────────────────────────────────────────
    {
      name: 'number',
      label: 'Номер',
      type: 'number',
      required: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Номер на контейнера по списъка на обслужващата фирма. Не е уникален между фирмите и е независим от идентификатора (ID) на записа.',
      },
    },
    {
      name: 'district',
      label: 'Административен район',
      type: 'relationship',
      relationTo: 'city-districts',
      required: false,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Административен район, в който се намира контейнерът',
      },
    },
    {
      name: 'company',
      label: 'Обслужваща фирма',
      type: 'relationship',
      relationTo: 'textile-companies',
      required: false,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Фирмата, която обслужва контейнера',
      },
    },
    // ── Tabbed area ───────────────────────────────────────────────────────
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Детайли',
          fields: [
            {
              name: 'address',
              label: 'Адрес',
              type: 'text',
              required: true,
              admin: {
                description: 'Четим адрес или описание на местоположението на контейнера',
              },
            },
            {
              name: 'location',
              type: 'point',
              label: 'Местоположение',
              required: true,
              admin: {
                description:
                  'Географски координати [дължина, ширина] – позволява геопространствени заявки',
              },
            },
            {
              name: 'status',
              label: 'Състояние',
              type: 'select',
              options: [...TEXTILE_STATUS_OPTIONS],
              required: false,
              index: true,
              admin: {
                description: 'Текущо състояние на контейнера',
              },
            },
            {
              name: 'notes',
              label: 'Бележки',
              type: 'textarea',
              admin: {
                description: 'Вътрешни бележки за контейнера',
              },
            },
          ],
        },
        {
          label: 'Карта',
          fields: [locationMapField],
        },
      ],
    },
  ],
}
