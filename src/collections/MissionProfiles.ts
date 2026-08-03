import type { CollectionConfig } from 'payload'
import {
  canViewCityInfrastructure,
  isCityInfrastructureAdmin,
} from '@/access/cityInfrastructureAdmin'
import { missionProfileMe } from '@/endpoints/missions/missionProfileMe'

const canManageMissionProfile = ({ req: { user } }: { req: { user?: { role?: string } | null } }) =>
  isCityInfrastructureAdmin(user?.role)

export const MissionProfiles: CollectionConfig = {
  slug: 'mission-profiles',
  labels: {
    singular: 'Профил за мисии',
    plural: 'Профили за мисии',
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'darPoints', 'contributorLevel', 'updatedAt'],
    group: 'Градска инфраструктура',
    description: 'Мисионни атрибути на гражданите (дарителски точки и ниво на приносител)',
    hidden: ({ user }) => user?.role === 'wasteCollector',
  },
  endpoints: [missionProfileMe],
  access: {
    admin: canViewCityInfrastructure,
    create: canManageMissionProfile,
    read: ({ req: { user } }) => {
      if (isCityInfrastructureAdmin(user?.role)) return true
      if (!user) return false
      return {
        user: {
          equals: user.id,
        },
      }
    },
    update: canManageMissionProfile,
    delete: canManageMissionProfile,
  },
  fields: [
    {
      name: 'user',
      label: 'Потребител',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'darPoints',
      label: 'Дарителски точки',
      type: 'number',
      defaultValue: 0,
      min: 0,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'contributorLevel',
      label: 'Ниво на доброволец',
      type: 'select',
      required: true,
      defaultValue: 'beginner',
      options: [
        { label: 'Начинаещ', value: 'beginner' },
        { label: 'Доброволец', value: 'contributor' },
        { label: 'Пазител', value: 'guardian' },
      ],
      admin: {
        description:
          'Ръчно предоставено ниво, което определя дали потребителят може да поема мисии на ниво contributor или guardian.',
      },
    },
  ],
  timestamps: true,
}
