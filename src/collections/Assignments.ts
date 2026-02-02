import type { CollectionConfig } from 'payload'

const canEditAssignments = ({ req: { user } }: any) => {
  return user?.role === 'containerAdmin' || user?.role === 'admin'
}

export const Assignments: CollectionConfig = {
  slug: 'assignments',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'assignedTo', 'dueDate', 'createdAt'],
    group: 'City Infrastructure',
  },
  access: {
    // Only admin role can access the admin panel
    admin: ({ req: { user } }) => user?.role === 'admin',
    // Only containerAdmin and admin can read/create/update/delete
    read: canEditAssignments,
    create: canEditAssignments,
    update: canEditAssignments,
    delete: canEditAssignments,
  },
  fields: [
    {
      name: 'title',
      label: 'Assignment Title',
      type: 'text',
      required: true,
      admin: {
        description: 'Title of the cleaning assignment',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      admin: {
        description: 'Additional notes or instructions for this assignment',
      },
    },
    {
      name: 'containers',
      label: 'Waste Containers',
      type: 'relationship',
      relationTo: 'waste-containers',
      hasMany: true,
      required: true,
      admin: {
        description: 'Select multiple containers for this cleaning assignment',
      },
    },
    {
      name: 'assignedTo',
      label: 'Assigned To',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User responsible for completing this assignment',
      },
    },
    {
      name: 'activities',
      label: 'Activities to Perform',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        {
          label: 'Full Container',
          value: 'full',
        },
        {
          label: 'Dirty',
          value: 'dirty',
        },
        {
          label: 'Damaged',
          value: 'damaged',
        },
        {
          label: 'Leaves',
          value: 'leaves',
        },
        {
          label: 'Maintenance',
          value: 'maintenance',
        },
        {
          label: 'Bagged Waste',
          value: 'bagged',
        },
        {
          label: 'Fallen Container',
          value: 'fallen',
        },
        {
          label: 'Bulky Waste',
          value: 'bulkyWaste',
        },
      ],
      defaultValue: ['full'],
      admin: {
        description: 'Types of cleaning/maintenance activities to be performed',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'In Progress',
          value: 'in-progress',
        },
        {
          label: 'Completed',
          value: 'completed',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
      ],
      admin: {
        description: 'Current status of the assignment',
      },
    },
    {
      name: 'dueDate',
      label: 'Due Date',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this assignment should be completed',
      },
    },
    {
      name: 'completedAt',
      label: 'Completed At',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this assignment was marked as completed',
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
