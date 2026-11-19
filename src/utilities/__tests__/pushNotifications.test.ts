// expo-server-sdk ships as ESM only, so replace it with a minimal fake client.
jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken(token: unknown): boolean {
      return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token)
    }

    chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
      return mockChunkPushNotifications(messages)
    }

    sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
      return mockSendPushNotificationsAsync(messages)
    }
  },
}))

jest.mock('../matchSubscriptions', () => ({
  matchSubscriptions: jest.fn(),
}))

import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import type { Payload } from 'payload'
import { matchSubscriptions } from '../matchSubscriptions'
import {
  sendNewsNotification,
  sendPushNotifications,
  sendPushNotificationsToTokens,
} from '../pushNotifications'

const mockChunkPushNotifications = jest.fn((messages: ExpoPushMessage[]) => [messages])
const mockSendPushNotificationsAsync = jest.fn(async (messages: ExpoPushMessage[]) =>
  messages.map((): ExpoPushTicket => ({ status: 'ok', id: 'ticket' }))
)
const mockMatchSubscriptions = jest.mocked(matchSubscriptions)

type PushTokenRef = { id: number; token: string; active?: boolean | null } | number | string
type SubscriptionDoc = { id: number; pushToken: PushTokenRef }
type NewsDoc = Parameters<typeof sendNewsNotification>[1]

const makePayload = (subscriptions: SubscriptionDoc[] = []) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: subscriptions })),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const asPayload = (payload: MockPayload) => payload as unknown as Payload

const subscription = (id: number, pushToken: PushTokenRef): SubscriptionDoc => ({ id, pushToken })

const token = (suffix: string) => `ExponentPushToken[${suffix}]`

const chunkInPairs = (messages: ExpoPushMessage[]): ExpoPushMessage[][] => {
  const chunks: ExpoPushMessage[][] = []
  for (let i = 0; i < messages.length; i += 2) chunks.push(messages.slice(i, i + 2))
  return chunks
}

const sentMessages = (): ExpoPushMessage[] =>
  mockSendPushNotificationsAsync.mock.calls.flatMap(([chunk]) => chunk)

const sentRecipients = () => sentMessages().map((message) => message.to)

const notification = {
  title: 'Water outage',
  body: 'No water in Lozenets until 18:00',
  data: { type: 'news', newsId: '7' },
}

beforeEach(() => {
  mockChunkPushNotifications.mockReset()
  mockChunkPushNotifications.mockImplementation((messages) => [messages])
  mockSendPushNotificationsAsync.mockReset()
  mockSendPushNotificationsAsync.mockImplementation(async (messages) =>
    messages.map((): ExpoPushTicket => ({ status: 'ok', id: 'ticket' }))
  )
  mockMatchSubscriptions.mockReset()
})

describe('sendPushNotifications (unit)', () => {
  it('loads enabled subscriptions with their push tokens populated', async () => {
    const payload = makePayload([subscription(1, { id: 10, token: token('a') })])

    await sendPushNotifications(asPayload(payload), notification)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'subscriptions',
      where: { enabled: { equals: true } },
      depth: 1,
      pagination: false,
    })
  })

  it('sends a high-priority message with sound to each eligible device', async () => {
    const payload = makePayload([
      subscription(1, { id: 10, token: token('a') }),
      subscription(2, { id: 11, token: token('b'), active: true }),
    ])

    await sendPushNotifications(asPayload(payload), notification)

    expect(sentMessages()).toEqual([
      {
        to: token('a'),
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: 'high',
      },
      {
        to: token('b'),
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: 'high',
      },
    ])
  })

  it('defaults the data payload to an empty object', async () => {
    const payload = makePayload([subscription(1, { id: 10, token: token('a') })])

    await sendPushNotifications(asPayload(payload), { title: 'Hi', body: 'There' })

    expect(sentMessages()).toEqual([expect.objectContaining({ data: {} })])
  })

  it('skips inactive and unpopulated tokens and notifies each device only once', async () => {
    const payload = makePayload([
      subscription(1, { id: 10, token: token('a') }),
      subscription(2, { id: 10, token: token('a') }),
      subscription(3, { id: 11, token: token('inactive'), active: false }),
      subscription(4, { id: 12, token: token('unknown-state'), active: null }),
      subscription(5, 13),
      subscription(6, '14'),
    ])

    await sendPushNotifications(asPayload(payload), notification)

    expect(sentRecipients()).toEqual([token('a'), token('unknown-state')])
  })

  it('warns about and skips tokens that are not valid Expo push tokens', async () => {
    const payload = makePayload([
      subscription(1, { id: 10, token: 'not-an-expo-token' }),
      subscription(2, { id: 11, token: token('a') }),
    ])

    await sendPushNotifications(asPayload(payload), notification)

    expect(sentRecipients()).toEqual([token('a')])
    expect(payload.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not-an-expo-token is not a valid Expo push token')
    )
  })

  it('does nothing when there are no enabled subscriptions', async () => {
    const payload = makePayload([])

    await sendPushNotifications(asPayload(payload), notification)

    expect(payload.logger.info).toHaveBeenCalledWith('No enabled subscriptions found')
    expect(mockChunkPushNotifications).not.toHaveBeenCalled()
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  it('does nothing when no subscription has an eligible token', async () => {
    const payload = makePayload([
      subscription(1, { id: 10, token: token('a'), active: false }),
      subscription(2, 11),
    ])

    await sendPushNotifications(asPayload(payload), notification)

    expect(payload.logger.info).toHaveBeenCalledWith(
      'No eligible push tokens after filtering enabled subscriptions'
    )
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  it('does nothing when none of the eligible tokens are valid Expo tokens', async () => {
    const payload = makePayload([subscription(1, { id: 10, token: 'garbage' })])

    await sendPushNotifications(asPayload(payload), notification)

    expect(payload.logger.info).toHaveBeenCalledWith('No valid push tokens to send to')
    expect(mockChunkPushNotifications).not.toHaveBeenCalled()
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  it('sends every chunk and keeps going when one chunk fails', async () => {
    mockChunkPushNotifications.mockImplementation(chunkInPairs)
    mockSendPushNotificationsAsync.mockImplementationOnce(async () => {
      throw new Error('expo unavailable')
    })
    const payload = makePayload(
      ['a', 'b', 'c', 'd', 'e'].map((suffix, i) => subscription(i, { id: i, token: token(suffix) }))
    )

    await sendPushNotifications(asPayload(payload), notification)

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(3)
    expect(sentRecipients()).toEqual(['a', 'b', 'c', 'd', 'e'].map(token))
    expect(payload.logger.error).toHaveBeenCalledWith(
      'Error sending push notification chunk: Error: expo unavailable'
    )
    expect(payload.logger.info).toHaveBeenCalledWith(
      'Sent 5 push notifications, received 3 tickets'
    )
  })

  it('logs tickets that Expo reports as errors', async () => {
    mockSendPushNotificationsAsync.mockImplementationOnce(async () => [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'DeviceNotRegistered' },
    ])
    const payload = makePayload([
      subscription(1, { id: 10, token: token('a') }),
      subscription(2, { id: 11, token: token('b') }),
    ])

    await sendPushNotifications(asPayload(payload), notification)

    expect(payload.logger.error).toHaveBeenCalledTimes(1)
    expect(payload.logger.error).toHaveBeenCalledWith(
      'Push notification error: DeviceNotRegistered'
    )
  })

  it('logs and rethrows when subscriptions cannot be loaded', async () => {
    const payload = makePayload()
    payload.find.mockRejectedValueOnce(new Error('db down'))

    await expect(sendPushNotifications(asPayload(payload), notification)).rejects.toThrow('db down')

    expect(payload.logger.error).toHaveBeenCalledWith(
      'Failed to send push notifications: Error: db down'
    )
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })
})

describe('sendNewsNotification (unit)', () => {
  const newsDoc = (overrides: Partial<NewsDoc> = {}): NewsDoc => ({
    id: 42,
    title: 'Ремонт на бул. Витоша',
    description: 'Движението ще бъде ограничено',
    ...overrides,
  })

  it('broadcasts to all subscribed devices when the news has no categories', async () => {
    for (const categories of [undefined, null, []]) {
      mockSendPushNotificationsAsync.mockClear()
      const payload = makePayload([subscription(1, { id: 10, token: token('a') })])

      await sendNewsNotification(asPayload(payload), newsDoc({ categories }))

      expect(payload.find).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'subscriptions' })
      )
      expect(sentMessages()).toEqual([
        expect.objectContaining({
          to: token('a'),
          title: 'Ремонт на бул. Витоша',
          body: 'Движението ще бъде ограничено',
          data: { type: 'news', newsId: '42' },
        }),
      ])
    }
    expect(mockMatchSubscriptions).not.toHaveBeenCalled()
  })

  it('only notifies matching subscribers when the news has categories', async () => {
    mockMatchSubscriptions.mockResolvedValueOnce([token('b'), token('c')])
    const payload = makePayload([subscription(1, { id: 10, token: token('a') })])
    const doc = newsDoc({ categories: [{ id: 3 }], district: 5 })

    await sendNewsNotification(asPayload(payload), doc)

    expect(mockMatchSubscriptions).toHaveBeenCalledWith(payload, doc)
    expect(payload.find).not.toHaveBeenCalled()
    expect(sentMessages()).toEqual([
      expect.objectContaining({ to: token('b'), data: { type: 'news', newsId: '42' } }),
      expect.objectContaining({ to: token('c'), data: { type: 'news', newsId: '42' } }),
    ])
  })

  it('sends nothing when no subscription matches the news categories', async () => {
    mockMatchSubscriptions.mockResolvedValueOnce([])
    const payload = makePayload([subscription(1, { id: 10, token: token('a') })])

    await sendNewsNotification(asPayload(payload), newsDoc({ categories: [3] }))

    expect(payload.logger.info).toHaveBeenCalledWith('No matching subscriptions for news 42')
    expect(payload.find).not.toHaveBeenCalled()
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })
})

describe('sendPushNotificationsToTokens (unit)', () => {
  it('sends the notification to every valid token', async () => {
    const payload = makePayload()

    await sendPushNotificationsToTokens(
      asPayload(payload),
      [token('a'), 'invalid', token('b')],
      notification
    )

    expect(sentMessages()).toEqual([
      {
        to: token('a'),
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: 'high',
      },
      {
        to: token('b'),
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: 'high',
      },
    ])
  })

  it('defaults the data payload to an empty object', async () => {
    await sendPushNotificationsToTokens(asPayload(makePayload()), [token('a')], {
      title: 'Hi',
      body: 'There',
    })

    expect(sentMessages()).toEqual([expect.objectContaining({ data: {} })])
  })

  it('does nothing when no token is a valid Expo token', async () => {
    const payload = makePayload()

    await sendPushNotificationsToTokens(asPayload(payload), ['invalid', ''], notification)

    expect(payload.logger.info).toHaveBeenCalledWith('No valid push tokens to send to')
    expect(mockChunkPushNotifications).not.toHaveBeenCalled()
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  it('sends every chunk and logs failed chunks without throwing', async () => {
    mockChunkPushNotifications.mockImplementation(chunkInPairs)
    mockSendPushNotificationsAsync.mockImplementationOnce(async () => {
      throw new Error('expo unavailable')
    })
    const payload = makePayload()
    const tokens = ['a', 'b', 'c'].map(token)

    await expect(
      sendPushNotificationsToTokens(asPayload(payload), tokens, notification)
    ).resolves.toBeUndefined()

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(2)
    expect(sentRecipients()).toEqual(tokens)
    expect(payload.logger.error).toHaveBeenCalledWith(
      'Error sending push notification chunk: Error: expo unavailable'
    )
  })
})
