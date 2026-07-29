import type { CollectionConfig } from 'payload'

export const BulkyWasteZones: CollectionConfig = {
  slug: 'bulky-waste-zones',
  labels: {
    singular: 'Зона за едрогабаритни отпадъци (ЕГО)',
    plural: 'Зони за едрогабаритни отпадъци (ЕГО)',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: 'Градска инфраструктура',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'sourceId',
      type: 'number',
      required: true,
      unique: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Зона',
    },
    {
      name: 'info',
      type: 'textarea',
      label: 'Информация/График за събиране',
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
        description: 'ISO номера на делничния ден (1=Пон, 7=Нед) за събиране на ЕГО',
      },
    },
    {
      name: 'boundary',
      type: 'json',
      required: true,
      label: 'Граница на зоната',
      admin: {
        description: 'Начертайте или редактирайте границата на зоната директно върху картата.',
        components: {
          Field: '@/fields/boundaryMap/BoundaryMapField#BoundaryMapField',
        },
      },
    },
  ],
}
