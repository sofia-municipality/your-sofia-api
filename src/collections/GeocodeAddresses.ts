import type { CollectionConfig } from 'payload'
import { locationMapField } from '@/fields/locationMap'

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
