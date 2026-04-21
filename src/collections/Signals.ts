import type { CollectionConfig, Access } from 'payload'
import type { WasteContainer } from '@/payload-types'
import { APIError } from 'payload'
import { randomUUID } from 'crypto'
import { canViewCityInfrastructure } from '@/access/cityInfrastructureAdmin'
import { isAdmin } from '@/access/isAdmin'
import { sendPushNotificationsToTokens } from '@/utilities/pushNotifications'

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

const canUpdate: Access = async ({ req, data, id }) => {
  if (canViewCityInfrastructure({ req })) return true

  // For non-admin updates, verify reporterUniqueId
  if (data && data.reporterUniqueId && id) {
    try {
      // Fetch the existing signal
      const existingSignal = await req.payload.findByID({
        collection: 'signals',
        id: id.toString(),
        overrideAccess: true,
      })

      // Check if the reporterUniqueId matches
      if (existingSignal.reporterUniqueId === data.reporterUniqueId) {
        return true
      }
    } catch (error) {
      req.payload.logger.error(`Error verifying reporterUniqueId: ${error}`)
      return false
    }
  }

  return false
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
    beforeValidate: [
      async ({ data, req, operation }) => {
        // Only run on create operation
        if (operation !== 'create' || !data) return data

        // Check for proximity restriction for non-admin users
        if (
          data.category === 'waste-container' &&
          data.cityObject?.referenceId &&
          data.location &&
          Array.isArray(data.location)
        ) {
          // Check if user is admin (skip proximity check for admins)
          const isAdminUser = req.user?.role === 'admin'

          if (!isAdminUser) {
            try {
              const [signalLng, signalLat] = data.location

              // Find the container by publicNumber
              const containers = await req.payload.find({
                collection: 'waste-containers',
                where: {
                  publicNumber: {
                    equals: data.cityObject.referenceId,
                  },
                },
                limit: 1,
              })

              if (containers.docs.length > 0) {
                const container = containers.docs[0]
                // Point field stores coordinates as [longitude, latitude]
                if (container && container.location && Array.isArray(container.location)) {
                  const [containerLng, containerLat] = container.location
                  const distance = calculateDistance(
                    signalLat,
                    signalLng,
                    containerLat,
                    containerLng
                  )

                  // Check if user is within 30 meters
                  if (distance > 30) {
                    req.payload.logger.warn(
                      `Signal rejected: User is ${Math.round(distance)}m away from container ${data.cityObject.referenceId} (max 30m allowed)`
                    )

                    throw new APIError(
                      `You must be within 30 meters of the container to report a signal. Current distance: ${Math.round(distance)}m`,
                      403
                    )
                  }
                }
              }
            } catch (error) {
              // If it's our custom APIError, re-throw it
              if (error instanceof APIError) {
                throw error
              }
              // For other errors, log and continue (fail-open)
              req.payload.logger.error(`Error checking proximity: ${error}`)
            }
          }
        }

        // Auto-create waste container if referenceId is empty for waste-container signals
        //TODO: Don't create duplicates if there is a container within X meters already
        if (
          data.category === 'waste-container' &&
          data.cityObject?.type === 'waste-container' &&
          !data.cityObject?.referenceId &&
          data.location &&
          Array.isArray(data.location)
        ) {
          try {
            // Generate a unique public number based on UUID
            const publicNumber = `SOF-WASTE-${randomUUID()}`

            // Create a new waste container
            const newContainer = await req.payload.create({
              collection: 'waste-containers',
              data: {
                publicNumber,
                status: 'active',
                source: 'community',
                wasteType: 'general',
                capacitySize: 'standard',
                capacityVolume: 3,
                // Point field format: [longitude, latitude]
                location: data.location as [number, number],
                address: data.address,
                notes: `Auto-created from signal. ${data.cityObject.name || 'New container'}`,
              },
              draft: false,
            })

            // Update the signal data with the new container reference
            data.cityObject.referenceId = publicNumber

            req.payload.logger.info(
              `Auto-created waste container ${publicNumber} (ID: ${newContainer.id}) from signal`
            )
          } catch (error) {
            req.payload.logger.error(`Failed to auto-create waste container: ${error}`)
            // Re-throw error to fail signal creation
            throw new APIError(
              `Failed to create new waste container: ${error instanceof Error ? error.message : 'Unknown error'}`,
              500
            )
          }
        }

        // Check for duplicate waste container signals
        if (
          data.category === 'waste-container' &&
          data.reporterUniqueId &&
          data.cityObject?.referenceId
        ) {
          try {
            // Find existing active signals from same reporter for same container
            const existingSignals = await req.payload.find({
              collection: 'signals',
              overrideAccess: true,
              where: {
                and: [
                  {
                    reporterUniqueId: {
                      equals: data.reporterUniqueId,
                    },
                  },
                  {
                    'cityObject.referenceId': {
                      equals: data.cityObject.referenceId,
                    },
                  },
                  {
                    category: {
                      equals: 'waste-container',
                    },
                  },
                  {
                    status: {
                      not_in: ['resolved', 'rejected'],
                    },
                  },
                ],
              },
              limit: 1,
            })

            if (existingSignals.docs.length > 0) {
              const existingSignal = existingSignals.docs[0]
              if (existingSignal) {
                req.payload.logger.warn(
                  `Duplicate signal attempt: Reporter ${data.reporterUniqueId} already has active signal #${existingSignal.id} for container ${data.cityObject.referenceId}`
                )

                throw new APIError(
                  `Signal for same object already exists. Signal ID: ${existingSignal.id}`,
                  403
                )
              }
            }
          } catch (error) {
            // If it's our custom APIError, re-throw it
            if (error instanceof APIError) {
              throw error
            }
            // For other errors, log and continue (fail-open)
            req.payload.logger.error(`Error checking for duplicate signals: ${error}`)
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // Only run on create operation
        if (operation !== 'create') return doc

        // Check if this is a waste container signal
        if (
          doc.category === 'waste-container' &&
          doc.cityObject?.type === 'waste-container' &&
          doc.cityObject?.referenceId
        ) {
          try {
            // Find the container by publicNumber
            const containers = await req.payload.find({
              collection: 'waste-containers',
              where: {
                publicNumber: {
                  equals: doc.cityObject.referenceId,
                },
              },
              limit: 1,
            })

            if (containers.docs.length > 0 && containers.docs[0]) {
              const container = containers.docs[0]
              const updateData: Partial<Pick<WasteContainer, 'status' | 'state'>> = {}

              // Update container status to "full" if signal reports it as full
              if (Array.isArray(doc.containerState) && doc.containerState.length > 0) {
                if (container.status !== 'full') {
                  updateData.status = 'full'
                }
              }

              // Update container state field with new states from signal
              if (Array.isArray(doc.containerState) && doc.containerState.length > 0) {
                // Get existing states or empty array
                const existingStates = Array.isArray(container.state) ? container.state : []

                // Merge states (add new ones, remove duplicates)
                const mergedStates = [...new Set([...existingStates, ...doc.containerState])]

                updateData.state = mergedStates as WasteContainer['state']
              }

              // Only update if there's something to update
              if (Object.keys(updateData).length > 0) {
                await req.payload.update({
                  collection: 'waste-containers',
                  id: container.id,
                  data: updateData,
                })

                req.payload.logger.info(
                  `Container ${doc.cityObject.referenceId} updated due to signal ${doc.id}. Changes: ${JSON.stringify(updateData)}`
                )
              }
            }
          } catch (error) {
            req.payload.logger.error(`Failed to update container for signal ${doc.id}: ${error}`)
          }
        }

        return doc
      },
      async ({ doc, req, previousDoc, operation }) => {
        // Only notify when a signal transitions to a closed status
        if (operation === 'create') return doc

        const closedStatuses = ['resolved', 'rejected']
        const statusChanged = previousDoc?.status !== doc.status
        const isClosed = closedStatuses.includes(doc.status)

        if (statusChanged && isClosed && doc.reporterUniqueId) {
          const statusLabel = doc.status === 'resolved' ? 'разрешен' : 'отхвърлен'
          try {
            const tokenResult = await req.payload.find({
              collection: 'push-tokens',
              where: {
                and: [
                  { reporterUniqueId: { equals: doc.reporterUniqueId } },
                  { active: { equals: true } },
                ],
              },
              limit: 10,
              overrideAccess: true,
            })

            const tokenStrings = tokenResult.docs.map((t) => t.token as string).filter(Boolean)

            if (tokenStrings.length === 0) {
              req.payload.logger.info(
                `[Signals] No active push token for reporterUniqueId ${doc.reporterUniqueId} — skipping notification`
              )
            } else {
              await sendPushNotificationsToTokens(req.payload, tokenStrings, {
                title: 'Сигналът ви беше затворен',
                body: `Вашият сигнал "${doc.title}" беше ${statusLabel}.`,
                data: { type: 'signal-closed', signalId: String(doc.id), status: doc.status },
              })
              req.payload.logger.info(
                `[Signals] Sent signal-closed notification for signal ${doc.id} to ${tokenStrings.length} token(s)`
              )
            }
          } catch (err) {
            req.payload.logger.error(
              `[Signals] Failed to send signal-closed notification for signal ${doc.id}: ${err}`
            )
          }
        }

        return doc
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        // Strip reporterUniqueId from responses for non-admin users.
        // Non-admins can still filter by it (they know their own ID),
        // but cannot read it out of other documents — preventing IDOR leakage.
        if (req.user?.role !== 'admin') {
          doc.reporterUniqueId = undefined
        }
        return doc
      },
    ],
  },
  access: {
    admin: canViewCityInfrastructure,
    read: () => true,
    create: () => true,
    update: canUpdate,
    delete: isAdmin,
  },
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
