import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import type { Payload } from 'payload'
import { matchSubscriptions } from './matchSubscriptions'

// Create a new Expo SDK client
const expo = new Expo()

interface PushNotificationData {
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * Send push notifications to all active devices
 */
export async function sendPushNotifications(
  payload: Payload,
  notification: PushNotificationData
): Promise<void> {
  try {
    // Fetch all active push tokens
    const tokensResult = await payload.find({
      collection: 'push-tokens',
      where: {
        active: {
          equals: true,
        },
      },
      limit: 1000, // Adjust as needed
    })

    if (!tokensResult.docs || tokensResult.docs.length === 0) {
      payload.logger.info('No active push tokens found')
      return
    }

    // Create messages
    const messages: ExpoPushMessage[] = []

    for (const tokenDoc of tokensResult.docs) {
      const pushToken = tokenDoc.token as string

      // Check that the token is valid
      if (!Expo.isExpoPushToken(pushToken)) {
        payload.logger.warn(`Push token ${pushToken} is not a valid Expo push token`)
        continue
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        priority: 'high',
      })
    }

    if (messages.length === 0) {
      payload.logger.info('No valid push tokens to send to')
      return
    }

    // Send notifications in chunks (Expo recommends batching)
    const chunks = expo.chunkPushNotifications(messages)
    const tickets: ExpoPushTicket[] = []

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)
      } catch (error) {
        payload.logger.error(`Error sending push notification chunk: ${error}`)
      }
    }

    // Log results
    payload.logger.info(
      `Sent ${messages.length} push notifications, received ${tickets.length} tickets`
    )

    // Check for errors in tickets
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        payload.logger.error(`Push notification error: ${ticket.message}`)
      }
    }
  } catch (error) {
    payload.logger.error(`Failed to send push notifications: ${error}`)
    throw error
  }
}

/**
 * Send a push notification for a specific news item.
 *
 * If the news item has one or more categories, only matching subscribers
 * receive the notification.  If no categories are set, the notification is
 * broadcast to all active tokens (legacy behaviour).
 */
export async function sendNewsNotification(
  payload: Payload,
  newsDoc: {
    id: string | number
    title: string
    description: string
    categories?: unknown[] | null
    district?: unknown
    location?: { latitude?: number | null; longitude?: number | null } | null
  }
): Promise<void> {
  const notification = {
    title: newsDoc.title,
    body: newsDoc.description,
    data: {
      type: 'news',
      newsId: String(newsDoc.id),
    },
  }

  const hasCategories = Array.isArray(newsDoc.categories) && newsDoc.categories.length > 0

  if (!hasCategories) {
    // Broadcast to all active tokens (legacy behaviour)
    await sendPushNotifications(payload, notification)
    return
  }

  // Targeted send: resolve matching push token strings
  const tokenStrings = await matchSubscriptions(payload, newsDoc as any)

  if (tokenStrings.length === 0) {
    payload.logger.info(`No matching subscriptions for news ${newsDoc.id}`)
    return
  }

  payload.logger.info(
    `Sending targeted notification to ${tokenStrings.length} subscribers for news ${newsDoc.id}`
  )

  await sendPushNotificationsToTokens(payload, tokenStrings, notification)
}

/**
 * Send push notifications to a specific list of Expo push token strings.
 */
export async function sendPushNotificationsToTokens(
  payload: Payload,
  tokenStrings: string[],
  notification: PushNotificationData
): Promise<void> {
  const messages: ExpoPushMessage[] = tokenStrings
    .filter((t) => Expo.isExpoPushToken(t))
    .map((token) => ({
      to: token,
      sound: 'default' as const,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      priority: 'high' as const,
    }))

  if (messages.length === 0) {
    payload.logger.info('No valid push tokens to send to')
    return
  }

  const chunks = expo.chunkPushNotifications(messages)

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk)
    } catch (error) {
      payload.logger.error(`Error sending push notification chunk: ${error}`)
    }
  }
}
