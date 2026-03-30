import type { CollectionConfig } from 'payload'
import { canViewCityInfrastructure } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'

export const CityDistricts: CollectionConfig = {
  slug: 'city-districts',
  labels: {
    singular: 'City District',
    plural: 'City Districts',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['districtId', 'name', 'wasteCollectionZone'],
    group: 'City Infrastructure',
    description: 'Sofia administrative districts (1–24)',
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: 'districtId',
  fields: [
    {
      name: 'districtId',
      label: 'District ID',
      type: 'number',
      required: true,
      unique: true,
      min: 1,
      max: 24,
      index: true,
      admin: {
        description: 'Numeric district identifier (1–24)',
      },
    },
    {
      name: 'name',
      label: 'District Name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the Sofia administrative district',
      },
    },
    {
      name: 'code',
      label: 'District Code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      minLength: 3,
      maxLength: 3,
      admin: {
        description:
          'Three-letter uppercase code: R + first two letters of the name, or R + initials for multi-word names (e.g. RKP for Krasna Polyana)',
      },
    },
    {
      name: 'wasteCollectionZone',
      label: 'Waste Collection Zone',
      type: 'relationship',
      relationTo: 'waste-collection-zones',
      required: false,
      admin: {
        description: 'The waste collection zone this district belongs to',
      },
    },
  ],
}
