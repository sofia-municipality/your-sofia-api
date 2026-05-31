import type { CollectionConfig, Access } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'

const canEditAssignments: Access = ({ req: { user } }) => {
  return isCityInfrastructureAdmin(user?.role)
}

const canReadAssignments: Access = ({ req: { user } }) => {
  return canEditAssignments({ req: { user } } as any) || user?.role === 'wasteCollector'
}

export const Assignments: CollectionConfig = {
  slug: 'assignments',
  labels: {
    singular: 'Задание',
    plural: 'Задания',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'assignedTo', 'dueDate', 'createdAt'],
    group: 'Градска инфраструктура',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: canReadAssignments,
    create: canEditAssignments,
    update: canEditAssignments,
    delete: canEditAssignments,
  },
  fields: [
    {
      name: 'title',
      label: 'Заглавие на заданието',
      type: 'text',
      required: true,
      admin: {
        description: 'Заглавие на заданието за почистване',
      },
    },
    {
      name: 'description',
      label: 'Описание',
      type: 'textarea',
      admin: {
        description: 'Допълнителни бележки или инструкции за заданието',
      },
    },
    {
      name: 'containers',
      label: 'Контейнери за отпадъци',
      type: 'relationship',
      relationTo: 'waste-containers',
      hasMany: true,
      required: true,
      admin: {
        description: 'Изберете контейнерите за това задание за почистване',
      },
    },
    {
      name: 'assignedTo',
      label: 'Възложено на',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Потребител, отговорен за изпълнение на заданието',
      },
    },
    {
      name: 'activities',
      label: 'Дейности за извършване',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        {
          label: 'Пълен контейнер',
          value: 'full',
        },
        {
          label: 'Замърсен',
          value: 'dirty',
        },
        {
          label: 'Повреден',
          value: 'damaged',
        },
        {
          label: 'Листа',
          value: 'leaves',
        },
        {
          label: 'Поддръжка',
          value: 'maintenance',
        },
        {
          label: 'Боклук в торби',
          value: 'bagged',
        },
        {
          label: 'Паднал контейнер',
          value: 'fallen',
        },
        {
          label: 'Едрогабаритен боклук',
          value: 'bulkyWaste',
        },
      ],
      defaultValue: ['full'],
      admin: {
        description: 'Видове дейности за почистване/поддръжка',
      },
    },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Чакащ',
          value: 'pending',
        },
        {
          label: 'В изпълнение',
          value: 'in-progress',
        },
        {
          label: 'Приключен',
          value: 'completed',
        },
        {
          label: 'Отменен',
          value: 'cancelled',
        },
      ],
      admin: {
        description: 'Текущ статус на заданието',
      },
    },
    {
      name: 'dueDate',
      label: 'Краен срок',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Кога трябва да бъде приключено заданието',
      },
    },
    {
      name: 'completedAt',
      label: 'Приключено на',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Кога заданието е отбелязано като приключено',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Auto-set completedAt when status changes to completed
        if (operation === 'update' && data.status === 'completed' && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
