import type { Access, CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'
import { beforeChangeSetInspector } from './hooks/beforeChangeSetInspector'
import { beforeChangeApplyStatusTimestamps } from './hooks/beforeChangeApplyStatusTimestamps'
import { beforeValidateLockTasks } from './hooks/beforeValidateLockTasks'
import { afterChangeCreditDarPoints } from './hooks/afterChangeCreditDarPoints'
import { afterChangeNotifyCitizen } from './hooks/afterChangeNotifyCitizen'
import { missionsFeed } from '@/endpoints/missions/missionsFeed'
import { claimMission } from '@/endpoints/missions/claimMission'
import { submitMissionTask } from '@/endpoints/missions/submitMissionTask'
import { submitMissionPhotos } from '@/endpoints/missions/submitMissionPhotos'
import { submitMissionForReview } from '@/endpoints/missions/submitMissionForReview'

const canManageMissions: Access = ({ req: { user } }) => isCityInfrastructureAdmin(user?.role)

// Citizens never get generic collection `update` access — all citizen-side
// mutations (claim / submit-task / submit-for-review) go through validated
// custom endpoints (`src/endpoints/missions/`) that call `payload.update`
// with `overrideAccess: true`. This keeps the write surface auditable and
// avoids exposing tasks/pointsReward/inspectorReviewNotes to mass-assignment.
//
// `ready_for_review` is also readable by any authenticated citizen (not just
// the owner) so they can browse and community-verify other citizens' missions
// — drafts/returned-for-improvement/cancelled stay hidden from everyone else.
const canReadMissions: Access = ({ req: { user } }) => {
  if (isCityInfrastructureAdmin(user?.role)) return true

  if (!user) {
    return { status: { in: ['open', 'completed'] } }
  }

  return {
    or: [
      { status: { in: ['open', 'completed', 'ready_for_review'] } },
      { citizen: { equals: user.id } },
    ],
  }
}

export const Missions: CollectionConfig = {
  slug: 'missions',
  labels: {
    singular: 'Мисия',
    plural: 'Мисии',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'level', 'status', 'pointsReward', 'citizen', 'createdAt'],
    group: 'Градска инфраструктура',
    description:
      'Граждански мисии, създадени от инспектор на база квалифициран сигнал за самостоятелно решаване',
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  defaultSort: '-createdAt',
  endpoints: [
    missionsFeed,
    claimMission,
    submitMissionTask,
    submitMissionPhotos,
    submitMissionForReview,
  ],
  hooks: {
    beforeValidate: [beforeValidateLockTasks],
    beforeChange: [beforeChangeSetInspector, beforeChangeApplyStatusTimestamps],
    afterChange: [afterChangeCreditDarPoints, afterChangeNotifyCitizen],
  },
  access: {
    admin: canViewCityInfrastructure,
    read: canReadMissions,
    create: canManageMissions,
    update: canManageMissions,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'signal',
      label: 'Сигнал',
      type: 'relationship',
      relationTo: 'signals',
      required: true,
      admin: {
        description: 'Сигналът, който инспекторът е квалифицирал като решим от гражданин',
        position: 'sidebar',
      },
    },
    {
      name: 'title',
      label: 'Заглавие',
      type: 'text',
      required: true,
      admin: {
        description: 'Заглавие на мисията, показвано на списъка с мисии',
      },
    },
    {
      name: 'description',
      label: 'Описание',
      type: 'textarea',
      admin: {
        description: 'Кратко описание на мисията за гражданина',
      },
    },
    {
      name: 'level',
      label: 'Ниво',
      type: 'select',
      required: true,
      defaultValue: 'good-first-mission',
      options: [
        { label: 'за начинаещи доброволци', value: 'good-first-mission' },
        { label: 'за опитни доброволци', value: 'verified-contributor' },
        { label: 'за опитни пазители', value: 'verified-guardian' },
      ],
      index: true,
      admin: {
        description: 'Определя кои граждани могат да поемат мисията от дъската с мисии',
      },
    },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Чернова', value: 'draft' },
        { label: 'Отворена', value: 'open' },
        { label: 'В изпълнение', value: 'in_progress' },
        { label: 'За преглед', value: 'ready_for_review' },
        { label: 'За подобрение', value: 'returned_for_improvement' },
        { label: 'Завършена', value: 'completed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
      index: true,
      admin: {
        description:
          'Чернова → Отворена (публикувана) → В изпълнение (поета) → За преглед → Завършена/За подобрение',
      },
    },
    {
      name: 'pointsReward',
      label: 'Награда (дарителски точки)',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 10,
      admin: {
        description: 'Брой дарителски точки, които гражданинът получава при успешно завършване',
      },
    },
    {
      name: 'pointsAwarded',
      label: 'Присъдени точки',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Действително присъдени точки (попълва се автоматично при завършване)',
        position: 'sidebar',
      },
    },
    {
      name: 'generalInstructions',
      label: 'Общи инструкции',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Общи насоки към гражданина — задължително да се спомене, че се изискват снимки преди и след изпълнение на мисията и на всяка задача',
      },
    },
    {
      name: 'tasks',
      label: 'Задачи',
      type: 'array',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Задача',
        plural: 'Задачи',
      },
      admin: {
        description:
          'Стъпки за изпълнение на мисията. След публикуване (статус извън Чернова/Отворена) списъкът не може да се преструктурира.',
      },
      fields: [
        {
          name: 'title',
          label: 'Заглавие на задачата',
          type: 'text',
          required: true,
        },
        {
          name: 'instructions',
          label: 'Инструкции',
          type: 'textarea',
          required: true,
        },
        {
          name: 'acceptanceCriteria',
          label: 'Критерии за приемане',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Например: "Височина на храста след подрязване ≤ 40см"',
          },
        },
        {
          name: 'requiresBeforePhoto',
          label: 'Изисква снимка "преди"',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'requiresAfterPhoto',
          label: 'Изисква снимка "след"',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'beforePhoto',
          label: 'Снимка "преди" (от гражданина)',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Попълва се от гражданина през мобилното приложение',
          },
        },
        {
          name: 'afterPhoto',
          label: 'Снимка "след" (от гражданина)',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Попълва се от гражданина през мобилното приложение',
          },
        },
        {
          name: 'completedByCitizenAt',
          label: 'Отбелязана като изпълнена на',
          type: 'date',
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
      ],
    },
    {
      name: 'missionBeforePhotos',
      label: 'Общи снимки "преди"',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Общи снимки на обекта преди началото на мисията',
      },
    },
    {
      name: 'missionAfterPhotos',
      label: 'Общи снимки "след"',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Общи снимки на обекта след завършване на мисията',
      },
    },
    {
      name: 'inspector',
      label: 'Инспектор',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'Инспекторът, създал и конфигурирал мисията',
        position: 'sidebar',
      },
    },
    {
      name: 'citizen',
      label: 'Гражданин',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Гражданинът, поел мисията (попълва се автоматично при "поемане")',
        position: 'sidebar',
      },
    },
    {
      name: 'claimedAt',
      label: 'Поета на',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'submittedForReviewAt',
      label: 'Подадена за преглед на',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'reviewedAt',
      label: 'Прегледана на',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'completedAt',
      label: 'Завършена на',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'inspectorReviewNotes',
      label: 'Бележки от прегледа',
      type: 'textarea',
      admin: {
        description: 'Обратна връзка от инспектора при одобрение или връщане за подобрение',
      },
    },
    {
      name: 'communityConsensus',
      label: 'Обществена проверка (информативно)',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Няма проверки', value: 'none' },
        { label: 'Потвърдено от доверен проверяващ', value: 'trusted_verified' },
        { label: 'Потвърдено от 3+ граждани', value: 'peer_verified' },
        { label: 'Разногласие', value: 'disputed' },
      ],
      admin: {
        readOnly: true,
        description: 'Само информативно за инспектора — не заменя неговото окончателно решение',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
