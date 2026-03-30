import type { CollectionConfig } from 'payload'
import { cityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'

export const WasteCollectionZones: CollectionConfig = {
  slug: 'waste-collection-zones',
  labels: {
    singular: 'Waste Collection Zone',
    plural: 'Waste Collection Zones',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['number', 'name', 'serviceCompanyId'],
    group: 'City Infrastructure',
    description: 'Maps collection zones to their administrative districts and service companies',
  },
  access: {
    admin: cityInfrastructureAdmin,
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: 'number',
  fields: [
    {
      name: 'number',
      label: 'Zone Number',
      type: 'number',
      required: true,
      unique: true,
      min: 1,
      max: 10,
      admin: {
        description: 'Zone number 1–10',
      },
    },
    {
      name: 'name',
      label: 'Zone Name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name (e.g. "Зона 1")',
      },
    },
    {
      name: 'serviceCompanyId',
      label: 'Service Company ID',
      type: 'number',
      required: false,
      admin: {
        description: 'Numeric ID of the waste collection company responsible for this zone',
      },
    },
  ],
}
