import type { CollectionConfig } from 'payload'
import { locationMapField } from '@/fields/locationMap'
import { cityInfrastructureAdmin } from '@/access/cityInfrastructureAdmin'

export const GeocodeAddresses: CollectionConfig = {
  slug: 'geocode-addresses',
  labels: { singular: 'Geocode Address', plural: 'Geocode Addresses' },
  admin: {
    useAsTitle: 'address',
    defaultColumns: ['address', 'districtHint', 'location', 'updatedAt'],
    group: 'City Infrastructure',
    description:
      'Street address geocoding cache. Missing coordinates = OpenStreetMap Nominatim API returned no results.',
  },
  timestamps: true,
  access: {
    admin: cityInfrastructureAdmin,
    read: ({ req: { user } }) => user?.role === 'admin',
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'address',
      label: 'Street Address',
      type: 'text',
      required: true,
      admin: { description: 'Normalized street address (without street-type prefix)' },
    },
    {
      name: 'districtHint',
      label: 'District',
      type: 'text',
      required: true,
      admin: { description: 'District code passed to Nominatim (e.g. TRIADICA)' },
    },
    {
      name: 'location',
      label: 'Coordinates',
      type: 'point',
      admin: { description: 'Coordinates — missing means address was not found' },
    },
    {
      type: 'collapsible',
      label: 'Карта',
      fields: [locationMapField],
    },
  ],
}
