import type { CollectionAfterChangeHook } from 'payload'
import { sendPushNotificationsToTokens } from '@/utilities/pushNotifications'

const notifyStatuses = ['completed', 'returned_for_improvement'] as const
type NotifyStatus = (typeof notifyStatuses)[number]

const notifContent: Record<NotifyStatus, { title: string; body: string }> = {
  completed: {
    title: 'Мисията е одобрена! 🎉',
    body: 'Инспектор одобри изпълнението на мисията. Дарителските ви точки са обновени.',
  },
  returned_for_improvement: {
    title: 'Мисията се нуждае от подобрение',
    body: 'Инспектор върна мисията с бележки — прегледайте я и я подайте отново.',
  },
}

export const afterChangeNotifyCitizen: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  const traceStart = Date.now()
  req.payload.logger.info(
    `[MissionsTrace][afterChangeNotifyCitizen] start op=${operation} mission=${String(doc.id)} prev=${String(previousDoc?.status ?? 'none')} next=${String(doc.status)}`
  )

  if (operation !== 'update') {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeNotifyCitizen] skip reason=non-update elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const statusChanged = previousDoc?.status !== doc.status
  const shouldNotify = notifyStatuses.includes(doc.status as NotifyStatus)
  if (!statusChanged || !shouldNotify || !doc.citizen) {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeNotifyCitizen] skip reason=not-eligible statusChanged=${statusChanged} shouldNotify=${shouldNotify} hasCitizen=${Boolean(doc.citizen)} elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const citizenId = typeof doc.citizen === 'object' ? doc.citizen?.id : doc.citizen
  if (!citizenId) {
    req.payload.logger.info(
      `[MissionsTrace][afterChangeNotifyCitizen] skip reason=missing-citizen-id elapsedMs=${Date.now() - traceStart}`
    )
    return doc
  }

  const content = notifContent[doc.status as NotifyStatus]

  req.payload.logger.info(
    `[MissionsTrace][afterChangeNotifyCitizen] queued citizen=${citizenId} status=${String(doc.status)} elapsedMs=${Date.now() - traceStart}`
  )

  // Do not block the admin save request on external push-notification calls.
  // If Expo push is slow/unreachable, mission status updates should still save immediately.
  void (async () => {
    const asyncStart = Date.now()
    try {
      req.payload.logger.info(
        `[MissionsTrace][afterChangeNotifyCitizen] async-start mission=${String(doc.id)} citizen=${citizenId}`
      )

      const tokenResult = await req.payload.find({
        collection: 'push-tokens',
        where: {
          and: [{ user: { equals: citizenId } }, { active: { equals: true } }],
        },
        limit: 10,
        overrideAccess: true,
      })

      const tokenStrings = tokenResult.docs.map((t) => t.token as string).filter(Boolean)

      req.payload.logger.info(
        `[MissionsTrace][afterChangeNotifyCitizen] token-scan count=${tokenStrings.length} elapsedMs=${Date.now() - asyncStart}`
      )

      if (tokenStrings.length === 0) {
        req.payload.logger.info(
          `[Missions] No active push token for user ${citizenId} — skipping notification`
        )
      } else {
        await sendPushNotificationsToTokens(req.payload, tokenStrings, {
          title: content.title,
          body: content.body,
          data: {
            type: 'mission-status-update',
            missionId: String(doc.id),
            status: doc.status,
          },
        })

        req.payload.logger.info(
          `[MissionsTrace][afterChangeNotifyCitizen] push-sent mission=${String(doc.id)} count=${tokenStrings.length} elapsedMs=${Date.now() - asyncStart}`
        )

        req.payload.logger.info(
          `[Missions] Sent mission-status-update (${doc.status}) notification for mission ${doc.id} to ${tokenStrings.length} token(s)`
        )
      }
    } catch (err) {
      req.payload.logger.error(
        `[MissionsTrace][afterChangeNotifyCitizen] failed mission=${String(doc.id)} citizen=${citizenId} elapsedMs=${Date.now() - asyncStart} error=${err}`
      )
    }
  })()

  req.payload.logger.info(
    `[MissionsTrace][afterChangeNotifyCitizen] return-doc elapsedMs=${Date.now() - traceStart}`
  )

  return doc
}
