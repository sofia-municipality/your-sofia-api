import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import type { Payload } from 'payload'

// Create a new Expo SDK client
const expo = new Expo()

interface PushNotificationData {
  title: string
  body: string
  data?: Record<string, any>
}

/**
 * Send push notifications to all active devices
 */
export async function sendPushNotifications(
  payload: Payload,
  notification: PushNotificationData,
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
      `Sent ${messages.length} push notifications, received ${tickets.length} tickets`,
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
 * Send a push notification for a specific news item
 */
export async function sendNewsNotification(
  payload: Payload,
  newsId: string | number,
  title: string,
  description: string,
): Promise<void> {
  await sendPushNotifications(payload, {
    title,
    body: description,
    data: {
      type: 'news',
      newsId: String(newsId),
    },
  })
}
