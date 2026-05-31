import type { CollectionConfig, Access } from 'payload'
import { cleanContainer } from '../endpoints/cleanContainer'
import { nearbyContainers } from '../endpoints/nearbyContainers'
import { containersWithSignalCount } from '@/endpoints/containers-with-signals'
import { collectionMetrics } from '@/endpoints/collection-metrics'
import { bulkUpdateContainerStatus } from '@/endpoints/bulkUpdateContainerStatus'
import { newlyCreatedContainersMetric } from '@/endpoints/newly-created-containers-metric'
import { locationMapField } from '@/fields/locationMap'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'

const canEditContainers: Access = ({ req: { user } }) => {
  return isCityInfrastructureAdmin(user?.role)
}

export const WasteContainers: CollectionConfig = {
  slug: 'waste-containers',
  labels: {
    singular: 'Контейнер за отпадъци',
    plural: 'Контейнери за отпадъци',
  },
  admin: {
    useAsTitle: 'publicNumber',
    defaultColumns: ['publicNumber', 'wasteType', 'capacitySize', 'status', 'servicedBy'],
    group: 'Градска инфраструктура',
    description: 'Управление на контейнерите за отпадъци в града',
    listSearchableFields: ['publicNumber', 'legacyId'],
  },
  endpoints: [
    cleanContainer,
    nearbyContainers,
    containersWithSignalCount,
    collectionMetrics,
    newlyCreatedContainersMetric,
    bulkUpdateContainerStatus,
  ],
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: canEditContainers,
    update: canEditContainers,
    delete: canEditContainers,
  },
  defaultSort: '-createdAt',
  fields: [
    // ── Sidebar fields (rendered outside of tabs) ─────────────────────────
    {
      name: 'legacyId',
      label: 'Идентификатор в стария систем',
      type: 'text',
      unique: true,
      admin: {
        description: 'Оригинален идентификатор от стария систем (за проследяване на миграцията)',
        position: 'sidebar',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Адрес',
      admin: {
        description: 'Четим адрес (напр. "ул. Витоша 1, София")',
        position: 'sidebar',
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
        description: 'Административен район на София (попълва се от GPS данни)',
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      label: 'Произход на данните',
      type: 'select',
      required: true,
      options: [
        { label: 'Съобщено от гражданин', value: 'community' },
        { label: 'Официални данни на Общината', value: 'official' },
        { label: 'Интеграция с трета страна', value: 'third_party' },
      ],
      defaultValue: 'community',
      admin: {
        description: 'Произход на данните за контейнера',
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
              name: 'publicNumber',
              label: 'Публичен номер на контейнера',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              admin: {
                description: 'Уникален идентификатор, видим за гражданите (напр. SOF-001, WC-123)',
              },
            },
            {
              name: 'image',
              label: 'Снимка на контейнера',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Снимка на контейнера за отпадъци',
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
              name: 'capacityVolume',
              label: 'Вместимост (куб. метри)',
              type: 'number',
              required: true,
              min: 0,
              admin: {
                description: 'Вместимост на контейнера в кубически метри (m³)',
              },
            },
            {
              name: 'capacitySize',
              label: 'Относителен размер',
              type: 'select',
              required: true,
              options: [
                { label: 'Много малък (< 0.5 m³)', value: 'tiny' },
                { label: 'Малък (0.5 - 1 m³)', value: 'small' },
                { label: 'Стандартен (1 - 3 m³)', value: 'standard' },
                { label: 'Голям (3 - 5 m³)', value: 'big' },
                { label: 'Промишлен (> 5 m³)', value: 'industrial' },
              ],
              defaultValue: 'standard',
              index: true,
              admin: {
                description: 'Относителна класификация на размера за лесно филтриране',
              },
            },
            {
              name: 'binCount',
              label: 'Брой контейнери',
              type: 'number',
              min: 1,
              defaultValue: 1,
              admin: {
                description: 'Брой физически контейнери на това място (по подразбиране: 1)',
              },
            },
            {
              name: 'collectionDaysOfWeek',
              label: 'Дни за събиране',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Понеделник', value: '1' },
                { label: 'Вторник', value: '2' },
                { label: 'Сряда', value: '3' },
                { label: 'Четвъртък', value: '4' },
                { label: 'Петък', value: '5' },
                { label: 'Събота', value: '6' },
                { label: 'Неделя', value: '7' },
              ],
              admin: {
                description: 'ISO номера на делничния ден (1=Пон, 7=Нед), от импорт на график',
              },
            },
            {
              name: 'collectionTimesPerDay',
              label: 'Пъти на събиране на ден',
              type: 'number',
              defaultValue: 1,
              min: 1,
              max: 5,
              admin: { description: 'Колко пъти на ден се събира този контейнер (1 до 5)' },
            },
            {
              name: 'scheduleSource',
              label: 'Източник на графика',
              type: 'text',
              admin: {
                description: 'напр. "2026-02/TRIADICA/1100" — попълва се от задача за импорт',
                readOnly: true,
              },
            },
            {
              name: 'servicedBy',
              label: 'Обслужва се от',
              type: 'text',
              required: false,
              admin: {
                description: 'Наименование на фирмата или услугата, отговорна за събирането',
              },
            },
            {
              name: 'wasteType',
              label: 'Вид отпадък',
              type: 'select',
              required: true,
              options: [
                { label: 'Битови отпадъци', value: 'general' },
                { label: 'Рециклируеми', value: 'recyclables' },
                { label: 'Органични/Компост', value: 'organic' },
                { label: 'Стъкло', value: 'glass' },
                { label: 'Хартия/Картон', value: 'paper' },
                { label: 'Пластмаса', value: 'plastic' },
                { label: 'Метал', value: 'metal' },
                { label: 'Кофа за боклук', value: 'trashCan' },
              ],
              defaultValue: 'general',
              index: true,
              admin: {
                description: 'Вид отпадък, приеман от контейнера',
              },
            },
            {
              name: 'status',
              label: 'Статус на контейнера',
              type: 'select',
              required: true,
              options: [
                { label: 'Активен', value: 'active' },
                { label: 'Пълен', value: 'full' },
                { label: 'Поддръжка', value: 'maintenance' },
                { label: 'Неактивен', value: 'inactive' },
                { label: 'Очаква одобрение', value: 'pending' },
              ],
              defaultValue: 'active',
              index: true,
              admin: {
                description: 'Оперативен статус на контейнера',
              },
            },
            {
              name: 'state',
              label: 'Текущо състояние',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Пълен', value: 'full' },
                { label: 'Замърсен', value: 'dirty' },
                { label: 'Повреден', value: 'damaged' },
                { label: 'Листа', value: 'leaves' },
                { label: 'Поддръжка', value: 'maintenance' },
                { label: 'Боклук в торби', value: 'bagged' },
                { label: 'Паднал', value: 'fallen' },
                { label: 'Едрогабаритен боклук', value: 'bulkyWaste' },
              ],
              admin: {
                description: 'Текущо(и) състояние(я) на контейнера (може да има повече от едно)',
              },
            },
            {
              name: 'notes',
              label: 'Допълнителни бележки',
              type: 'textarea',
              admin: {
                description: 'Допълнителна информация за контейнера',
              },
            },
            {
              name: 'lastCleaned',
              label: 'Последно почистен',
              type: 'date',
              admin: {
                description: 'Дата и час, когато контейнерът е бил последно почистен',
                date: {
                  pickerAppearance: 'dayAndTime',
                },
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
