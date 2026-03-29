import type { CollectionConfig, Access } from 'payload'
import { cleanContainer } from '../endpoints/cleanContainer'
import { nearbyContainers } from '../endpoints/nearbyContainers'
import { containersWithSignalCount } from '@/endpoints/containers-with-signals'
import { collectionMetrics } from '@/endpoints/collection-metrics'
import { locationMapField } from '@/fields/locationMap'

const canEditContainers: Access = ({ req: { user } }) => {
  return user?.role === 'containerAdmin' || user?.role === 'admin'
}

export const WasteContainers: CollectionConfig = {
  slug: 'waste-containers',
  labels: {
    singular: 'Waste Container',
    plural: 'Waste Containers',
  },
  admin: {
    useAsTitle: 'publicNumber',
    defaultColumns: ['publicNumber', 'wasteType', 'capacitySize', 'status', 'servicedBy'],
    group: 'City Infrastructure',
    description: 'Manage waste containers across the city',
    listSearchableFields: ['publicNumber', 'legacyId'],
  },
  endpoints: [cleanContainer, nearbyContainers, containersWithSignalCount, collectionMetrics],
  access: {
    admin: ({ req: { user } }) => user?.role === 'admin',
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
      label: 'Legacy System ID',
      type: 'text',
      unique: true,
      admin: {
        description: 'Original ID from the legacy system (for migration tracking)',
        position: 'sidebar',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Address',
      admin: {
        description: 'Human-readable address (e.g., "ul. Vitosha 1, Sofia")',
        position: 'sidebar',
      },
    },
    {
      name: 'district',
      label: 'Administrative District',
      type: 'relationship',
      relationTo: 'city-districts',
      required: false,
      index: true,
      admin: {
        description: 'Sofia administrative district (populated from GPS data going forward)',
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      label: 'Data Source',
      type: 'select',
      required: true,
      options: [
        { label: 'Community Reported', value: 'community' },
        { label: 'Official Municipality Data', value: 'official' },
        { label: 'Third Party Integration', value: 'third_party' },
      ],
      defaultValue: 'community',
      admin: {
        description: 'Source of the container data',
        position: 'sidebar',
      },
    },
    // ── Tabbed area ───────────────────────────────────────────────────────
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
          fields: [
            {
              name: 'publicNumber',
              label: 'Public Container Number',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              admin: {
                description: 'Unique identifier visible to citizens (e.g., SOF-001, WC-123)',
              },
            },
            {
              name: 'image',
              label: 'Container Image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Photo of the waste container',
              },
            },
            {
              name: 'location',
              type: 'point',
              label: 'Location',
              required: true,
              admin: {
                description:
                  'Geographic coordinates [longitude, latitude] - enables geospatial queries',
              },
            },
            {
              name: 'capacityVolume',
              label: 'Capacity (cubic meters)',
              type: 'number',
              required: true,
              min: 0,
              admin: {
                description: 'Container capacity in cubic meters (m³)',
              },
            },
            {
              name: 'capacitySize',
              label: 'Relative Capacity Size',
              type: 'select',
              required: true,
              options: [
                { label: 'Tiny (< 0.5 m³)', value: 'tiny' },
                { label: 'Small (0.5 - 1 m³)', value: 'small' },
                { label: 'Standard (1 - 3 m³)', value: 'standard' },
                { label: 'Big (3 - 5 m³)', value: 'big' },
                { label: 'Industrial (> 5 m³)', value: 'industrial' },
              ],
              defaultValue: 'standard',
              index: true,
              admin: {
                description: 'Relative size classification for easy filtering',
              },
            },
            {
              name: 'binCount',
              label: 'Number of Bins',
              type: 'number',
              min: 1,
              defaultValue: 1,
              admin: {
                description: 'Number of physical bins at this location (default: 1)',
              },
            },
            {
              name: 'serviceInterval',
              label: 'Service Interval',
              type: 'text',
              required: false,
              admin: {
                description:
                  'How often the container is serviced (e.g., "Daily", "Every Monday and Thursday", "Twice a week")',
              },
            },
            {
              name: 'collectionDaysOfWeek',
              label: 'Collection Days of Week',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Monday', value: '1' },
                { label: 'Tuesday', value: '2' },
                { label: 'Wednesday', value: '3' },
                { label: 'Thursday', value: '4' },
                { label: 'Friday', value: '5' },
                { label: 'Saturday', value: '6' },
                { label: 'Sunday', value: '7' },
              ],
              admin: { description: 'ISO weekday numbers (1=Mon, 7=Sun) from schedule import' },
            },
            {
              name: 'collectionTimesPerDay',
              label: 'Collection Times per Day',
              type: 'number',
              defaultValue: 1,
              min: 1,
              max: 2,
              admin: { description: 'How many times per day this container is collected (1 or 2)' },
            },
            {
              name: 'scheduleSource',
              label: 'Schedule Source',
              type: 'text',
              admin: {
                description: 'e.g. "2026-02/TRIADICA/1100" — populated by import task',
                readOnly: true,
              },
            },
            {
              name: 'servicedBy',
              label: 'Serviced By',
              type: 'text',
              required: false,
              admin: {
                description: 'Name of the company or service responsible for collection',
              },
            },
            {
              name: 'wasteType',
              label: 'Waste Type',
              type: 'select',
              required: true,
              options: [
                { label: 'General Waste', value: 'general' },
                { label: 'Recyclables', value: 'recyclables' },
                { label: 'Organic/Compost', value: 'organic' },
                { label: 'Glass', value: 'glass' },
                { label: 'Paper/Cardboard', value: 'paper' },
                { label: 'Plastic', value: 'plastic' },
                { label: 'Metal', value: 'metal' },
                { label: 'Trash Can', value: 'trashCan' },
              ],
              defaultValue: 'general',
              index: true,
              admin: {
                description: 'Type of waste this container accepts',
              },
            },
            {
              name: 'status',
              label: 'Container Status',
              type: 'select',
              required: true,
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Full', value: 'full' },
                { label: 'Maintenance', value: 'maintenance' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Pending Approval', value: 'pending' },
              ],
              defaultValue: 'active',
              index: true,
              admin: {
                description: 'Operational status of the container',
              },
            },
            {
              name: 'state',
              label: 'Container State',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Full', value: 'full' },
                { label: 'Dirty', value: 'dirty' },
                { label: 'Damaged', value: 'damaged' },
                { label: 'Leaves', value: 'leaves' },
                { label: 'Maintenance', value: 'maintenance' },
                { label: 'Bagged Waste', value: 'bagged' },
                { label: 'Fallen', value: 'fallen' },
                { label: 'Bulky Waste', value: 'bulkyWaste' },
              ],
              admin: {
                description: 'Current state(s) of the waste container (can have multiple states)',
              },
            },
            {
              name: 'notes',
              label: 'Additional Notes',
              type: 'textarea',
              admin: {
                description: 'Any additional information about this container',
              },
            },
            {
              name: 'lastCleaned',
              label: 'Last Cleaned',
              type: 'date',
              admin: {
                description: 'Timestamp when the container was last marked as clean',
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
