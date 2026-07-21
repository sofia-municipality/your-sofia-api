import type { Access, CollectionConfig } from 'payload'
import { locationMapField } from '@/fields/locationMap'
import { nearbyFountains } from '@/endpoints/nearbyFountains'
import { fountainsMapData } from '@/endpoints/fountainsMapData'
import { afterChangeSetFountainPublicNumber } from '@/collections/hooks/afterChangeSetFountainPublicNumber'
import { canManageFountains, canViewFountains } from '@/access/cityInfrastructureAdmin'

const canEditFountains: Access = ({ req: { user } }) => canManageFountains(user?.role)

export const DrinkingFountains: CollectionConfig = {
  slug: 'drinking-fountains',
  labels: {
    singular: 'Чешма',
    plural: 'Чешми',
  },
  endpoints: [nearbyFountains, fountainsMapData],
  admin: {
    useAsTitle: 'address',
    defaultColumns: ['publicNumber', 'address', 'district', 'status', 'source', 'isActive'],
    group: 'Градска инфраструктура',
    description: 'Управление на чешмите в града',
    listSearchableFields: ['address', 'publicNumber'],
    hidden: ({ user }) => !canViewFountains({ req: { user } } as any),
  },
  access: {
    admin: canViewFountains,
    read: () => true,
    create: canEditFountains,
    update: canEditFountains,
    delete: canEditFountains,
  },
  hooks: {
    afterChange: [afterChangeSetFountainPublicNumber],
  },
  defaultSort: '-createdAt',
  fields: [
    // ── Sidebar fields (rendered outside of tabs) ─────────────────────────
    {
      name: 'publicNumber',
      label: 'Идентификатор',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Автоматично генериран идентификатор (напр. DF-RTR-0001)',
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
        description: 'Административен район на София, в който се намира чешмата',
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      label: 'Произход на водата',
      type: 'relationship',
      relationTo: 'drinking-fountain-source',
      required: false,
      admin: {
        description: 'Източник на водата (напр. Софийска вода, Минерална, Изворна)',
        position: 'sidebar',
      },
    },
    {
      name: 'owner',
      label: 'Собственик/поддръжка',
      type: 'relationship',
      relationTo: 'fountain-owner',
      required: false,
      admin: {
        description: 'Собственик или отговорник за поддръжката на чешмата',
        position: 'sidebar',
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
                description: 'Четим адрес или описание на местоположението на чешмата',
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
              type: 'relationship',
              relationTo: 'fountain-status',
              required: false,
              index: true,
              admin: {
                description: 'Текущо състояние/статус на чешмата',
              },
            },
            {
              name: 'activationType',
              label: 'Начин на активиране',
              type: 'relationship',
              relationTo: 'fountain-activation-type',
              required: false,
              admin: {
                description: 'Механизъм за пускане на водата (напр. Бутон, Кран, Канелка)',
              },
            },
            {
              name: 'isActive',
              label: 'Действаща',
              type: 'checkbox',
              admin: {
                description: 'Дали чешмата работи в момента',
              },
            },
            {
              name: 'protectionStatus',
              label: 'Статут на защита',
              type: 'textarea',
              admin: {
                description:
                  'Забележки за статут на паметник на културата или друга защита (ако е приложимо)',
              },
            },
            {
              name: 'externalLink',
              label: 'Външна връзка',
              type: 'text',
              admin: {
                description: 'Връзка към допълнителна информация за чешмата (по избор)',
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
