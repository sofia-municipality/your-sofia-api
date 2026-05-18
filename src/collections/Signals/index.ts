import type { CollectionConfig, Access } from 'payload'
import { canViewCityInfrastructure } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'
import { beforeValidateSignal } from './hooks/beforeValidateSignal'
import { beforeChangeSetReporter } from './hooks/beforeChangeSetReporter'
import { afterChangeUpdateContainer } from './hooks/afterChangeUpdateContainer'
import { afterChangeNotifyReporter } from './hooks/afterChangeNotifyReporter'
import {
  signalsAgeMetric,
  signalsStatusMetric,
  signalsActiveContainerStateMetric,
} from '@/endpoints/signals-metrics'

const canUpdate: Access = async ({ req, id }) => {
  if (canViewCityInfrastructure({ req })) return true

  if (!req.user || !id) return false

  try {
    const existingSignal = await req.payload.findByID({
      collection: 'signals',
      id: id.toString(),
      overrideAccess: true,
    })

    // Reporter is stored as a user ID (number). Compare as strings for safety.
    const reporterId =
      typeof existingSignal.reporter === 'object'
        ? existingSignal.reporter?.id
        : existingSignal.reporter

    return String(reporterId) === String(req.user.id)
  } catch (error) {
    req.payload.logger.error(`Error verifying signal reporter: ${error}`)
    return false
  }
}

export const Signals: CollectionConfig = {
  slug: 'signals',
  labels: {
    singular: 'Сигнал',
    plural: 'Сигнали',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'createdAt', 'reporterUniqueId'],
    group: 'Градска инфраструктура',
    description: 'Сигнали от граждани за проблеми',
    listSearchableFields: ['title', 'reporterUniqueId'],
  },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [beforeValidateSignal],
    beforeChange: [beforeChangeSetReporter],
    afterChange: [afterChangeUpdateContainer, afterChangeNotifyReporter],
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: ({ req: { user } }) => {
      return !!user
    },
    update: canUpdate,
    delete: isAdmin,
  },
  endpoints: [signalsAgeMetric, signalsStatusMetric, signalsActiveContainerStateMetric],
  fields: [
    {
      name: 'title',
      label: 'Заглавие',
      type: 'text',
      required: true,
      admin: {
        description: 'Кратко описание на сигнала',
      },
    },
    {
      name: 'description',
      label: 'Описание',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Подробно описание на проблема',
      },
    },
    {
      name: 'category',
      label: 'Категория',
      type: 'select',
      required: true,
      options: [
        { label: 'Проблем с контейнер за отпадъци', value: 'waste-container' },
        { label: 'Щета на улицата', value: 'street-damage' },
        { label: 'Осветление', value: 'lighting' },
        { label: 'Зелени площи', value: 'green-spaces' },
        { label: 'Паркиране', value: 'parking' },
        { label: 'Градски транспорт', value: 'public-transport' },
        { label: 'Друго', value: 'other' },
      ],
      defaultValue: 'other',
      index: true,
      admin: {
        description: 'Вид на сигнализирания проблем',
      },
    },
    {
      name: 'cityObject',
      label: 'Свързан градски обект',
      type: 'group',
      admin: {
        description: 'Препратка към свързан градски обект (напр. контейнер за отпадъци)',
      },
      fields: [
        {
          name: 'type',
          label: 'Тип обект',
          type: 'select',
          options: [
            { label: 'Контейнер за отпадъци', value: 'waste-container' },
            { label: 'Улица', value: 'street' },
            { label: 'Парк', value: 'park' },
            { label: 'Сграда', value: 'building' },
            { label: 'Друго', value: 'other' },
          ],
        },
        {
          name: 'referenceId',
          label: 'Идентификатор на обекта',
          type: 'text',
          admin: {
            description: 'Идентификатор или референтен номер на свързания обект',
          },
        },
        {
          name: 'name',
          label: 'Наименование на обекта',
          type: 'text',
          admin: {
            description: 'Наименование или описание на свързания обект',
          },
        },
      ],
    },
    {
      name: 'containerState',
      label: 'Състояние на контейнера',
      type: 'select',
      hasMany: true,
      admin: {
        description: 'Състояние на контейнера за отпадъци (само за сигнали за контейнери)',
        condition: (data, _siblingData) => {
          return (
            data?.category === 'waste-container' || data?.cityObject?.type === 'waste-container'
          )
        },
      },
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
    },
    {
      name: 'location',
      type: 'point',
      label: 'Местоположение',
      admin: {
        description: 'Географски координати [дължина, ширина] на сигнализирания проблем',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Адрес',
      admin: {
        description: 'Четим адрес на местоположението',
        position: 'sidebar',
      },
    },
    {
      name: 'images',
      label: 'Снимки',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Снимки на проблема',
      },
    },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Чакащ', value: 'pending' },
        { label: 'В изпълнение', value: 'in-progress' },
        { label: 'Разрешен', value: 'resolved' },
        { label: 'Отхвърлен', value: 'rejected' },
      ],
      index: true,
      admin: {
        description: 'Текущ статус на сигнала',
      },
    },
    {
      name: 'adminNotes',
      label: 'Бележки на администратора',
      type: 'textarea',
      admin: {
        description: 'Вътрешни бележки от администратори',
        condition: (data, siblingData, { user }) => Boolean(user),
      },
    },
    {
      name: 'reporter',
      label: 'Подател',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      index: true,
      admin: {
        description: 'Потребителят, подал сигнала',
        position: 'sidebar',
      },
    },
    {
      name: 'reporterUniqueId',
      label: 'Анонимен идентификатор на подателя',
      type: 'text',
      index: true,
      admin: {
        description: 'Уникален анонимен идентификатор на подателя (за обратна връзка)',
        position: 'sidebar',
      },
    },
  ],
}
