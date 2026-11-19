jest.mock('../../../utilities/matchSubscriptions', () => ({
  matchSubscriptions: jest.fn(),
}))

// Mock push notifications utility to avoid expo-server-sdk ESM issues
jest.mock('../../../utilities/pushNotifications', () => ({
  sendPushNotifications: jest.fn(),
  sendPushNotificationsToTokens: jest.fn(),
}))

import type { TaskHandler } from 'payload'
import { matchSubscriptions } from '../../../utilities/matchSubscriptions'
import {
  sendPushNotifications,
  sendPushNotificationsToTokens,
} from '../../../utilities/pushNotifications'
import { sendUpdatesNotifications } from '../sendUpdatesNotifications'

const mockMatchSubscriptions = jest.mocked(matchSubscriptions)
const mockSendPushNotifications = jest.mocked(sendPushNotifications)
const mockSendPushNotificationsToTokens = jest.mocked(sendPushNotificationsToTokens)

type UpdateMessage = {
  id?: string
  text: string
  plainText?: string
  createdAt: string
  categories?: string[]
  geoJson?: unknown
  pins?: Array<{ address?: string; coordinates?: { lat: number; lng: number } }>
}
type CategoryDoc = { id: number; slug: string }
type CategoryQuery = { where: { slug: { in: string[] } } }
type TaskArgs = Parameters<TaskHandler<'sendUpdatesNotifications'>>[0]

const NOW = new Date('2026-05-10T12:00:00.000Z')
const LAST_RUN = '2026-05-10T11:45:00.000Z'
const TITLE = 'Ново известие в Твоята София'

const makePayload = ({
  lastUpdatesNotifiedAt = LAST_RUN as string | null,
  categories = [] as CategoryDoc[],
} = {}) => ({
  findGlobal: jest.fn(async (_args: unknown) => ({ lastUpdatesNotifiedAt })),
  updateGlobal: jest.fn(async (_args: unknown) => ({})),
  find: jest.fn(async ({ where }: CategoryQuery) => ({
    docs: categories.filter((category) => where.slug.in.includes(category.slug)),
  })),
  logger: { info: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runTask = (payload: MockPayload) => {
  const handler = sendUpdatesNotifications.handler as TaskHandler<'sendUpdatesNotifications'>
  return handler({ req: { payload } } as unknown as TaskArgs)
}

const update = (overrides: Partial<UpdateMessage> = {}): UpdateMessage => ({
  id: 'u1',
  text: '<p>Спиране на водата в Лозенец</p>',
  plainText: 'Спиране на водата в Лозенец',
  createdAt: '2026-05-10T11:50:00.000Z',
  ...overrides,
})

describe('sendUpdatesNotifications task (unit)', () => {
  const originalBaseUrl = process.env.OBOAPP_UPDATES_BASE_URL
  const originalApiKey = process.env.OBOAPP_API_KEY
  let fetchMock: jest.SpiedFunction<typeof fetch>

  const respondWith = (body: unknown, status = 200) =>
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        })
    )

  const respondWithMessages = (messages: UpdateMessage[]) => respondWith({ messages })

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    process.env.OBOAPP_UPDATES_BASE_URL = 'https://obo.example.com/api/v1/'
    process.env.OBOAPP_API_KEY = 'test-api-key'
    fetchMock = jest.spyOn(global, 'fetch')
    respondWithMessages([])
    mockMatchSubscriptions.mockReset()
    mockSendPushNotifications.mockReset()
    mockSendPushNotificationsToTokens.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
    fetchMock.mockRestore()

    if (originalBaseUrl === undefined) {
      Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
    } else {
      process.env.OBOAPP_UPDATES_BASE_URL = originalBaseUrl
    }

    if (originalApiKey === undefined) {
      Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
    } else {
      process.env.OBOAPP_API_KEY = originalApiKey
    }
  })

  describe('fetching updates', () => {
    it('requests the current updates from the upstream with the API key', async () => {
      await runTask(makePayload())

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('https://obo.example.com/api/v1/messages', {
        headers: { Accept: 'application/json', 'X-Api-Key': 'test-api-key' },
        signal: expect.any(AbortSignal),
      })
    })

    it('skips the run when the upstream URL is not configured', async () => {
      Reflect.deleteProperty(process.env, 'OBOAPP_UPDATES_BASE_URL')
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('OBOAPP_UPDATES_BASE_URL is not configured')
      )
      expect(fetchMock).not.toHaveBeenCalled()
      expect(payload.updateGlobal).not.toHaveBeenCalled()
    })

    it('skips the run when the API key is not configured', async () => {
      Reflect.deleteProperty(process.env, 'OBOAPP_API_KEY')
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('OBOAPP_API_KEY is not configured')
      )
      expect(fetchMock).not.toHaveBeenCalled()
      expect(payload.updateGlobal).not.toHaveBeenCalled()
    })

    it('keeps the previous checkpoint when the upstream responds with an error', async () => {
      respondWith({ error: 'unavailable' }, 503)
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Upstream returned 503')
      )
      expect(payload.updateGlobal).not.toHaveBeenCalled()
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('keeps the previous checkpoint when the upstream request fails', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'))
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch upstream updates: Error: connect ECONNREFUSED')
      )
      expect(payload.updateGlobal).not.toHaveBeenCalled()
    })

    it('treats a response without messages as having no updates', async () => {
      respondWith({})
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.updateGlobal).toHaveBeenCalled()
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })
  })

  describe('selecting new updates', () => {
    it('only notifies about updates created after the last run', async () => {
      respondWithMessages([
        update({ id: 'old', createdAt: '2026-05-10T11:30:00.000Z' }),
        update({ id: 'at-checkpoint', createdAt: LAST_RUN }),
        update({ id: 'new', createdAt: '2026-05-10T11:46:00.000Z' }),
        update({ id: 'no-date', createdAt: '' }),
        update({ id: 'bad-date', createdAt: 'yesterday' }),
      ])
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 1 } })

      expect(payload.findGlobal).toHaveBeenCalledWith({
        slug: 'notification-settings',
        overrideAccess: true,
      })
      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ data: { type: 'update', updateId: 'new' } })
      )
    })

    it('looks back 15 minutes when the task has never run before', async () => {
      respondWithMessages([
        update({ id: 'recent', createdAt: '2026-05-10T11:46:00.000Z' }),
        update({ id: 'stale', createdAt: '2026-05-10T11:44:00.000Z' }),
      ])

      await expect(runTask(makePayload({ lastUpdatesNotifiedAt: null }))).resolves.toEqual({
        output: { notified: 1 },
      })

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: { type: 'update', updateId: 'recent' } })
      )
    })

    it('records the run time before sending any notification', async () => {
      respondWithMessages([update()])
      const payload = makePayload()

      await runTask(payload)

      expect(payload.updateGlobal).toHaveBeenCalledWith({
        slug: 'notification-settings',
        data: { lastUpdatesNotifiedAt: NOW.toISOString() },
        overrideAccess: true,
      })
      expect(payload.updateGlobal.mock.invocationCallOrder[0]).toBeLessThan(
        mockSendPushNotifications.mock.invocationCallOrder[0]!
      )
    })

    it('records the run time even when there is nothing new', async () => {
      respondWithMessages([update({ createdAt: '2026-05-10T11:00:00.000Z' })])
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 0 } })

      expect(payload.updateGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lastUpdatesNotifiedAt: NOW.toISOString() } })
      )
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendPushNotificationsToTokens).not.toHaveBeenCalled()
    })
  })

  describe('sending notifications', () => {
    it('broadcasts updates without categories to all subscribers', async () => {
      respondWithMessages([update({ id: 'u1' }), update({ id: 'u2', categories: [] })])
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 2 } })

      expect(mockSendPushNotifications.mock.calls).toEqual([
        [
          payload,
          {
            title: TITLE,
            body: 'Спиране на водата в Лозенец',
            data: { type: 'update', updateId: 'u1' },
          },
        ],
        [
          payload,
          {
            title: TITLE,
            body: 'Спиране на водата в Лозенец',
            data: { type: 'update', updateId: 'u2' },
          },
        ],
      ])
      expect(payload.find).not.toHaveBeenCalled()
      expect(mockMatchSubscriptions).not.toHaveBeenCalled()
    })

    it('builds a short notification body from the update text', async () => {
      const longText = 'Ремонт '.repeat(40)
      respondWithMessages([
        update({ id: 'long', plainText: longText }),
        update({ id: 'padded', plainText: '  Авария на ул. Шипка \n' }),
        update({ id: undefined, plainText: undefined, text: 'Без форматиране' }),
      ])

      await runTask(makePayload())

      const notifications = mockSendPushNotifications.mock.calls.map(([, notification]) => ({
        body: notification.body,
        data: notification.data,
      }))
      expect(notifications).toEqual([
        { body: longText.slice(0, 150).trim(), data: { type: 'update', updateId: 'long' } },
        { body: 'Авария на ул. Шипка', data: { type: 'update', updateId: 'padded' } },
        { body: 'Без форматиране', data: { type: 'update', updateId: '' } },
      ])
      expect(notifications[0]?.body.length).toBeLessThanOrEqual(150)
    })

    // BUG (bugs.md #8): `??` doesn't fall back to `text` when `plainText` is an empty string.
    it.failing('falls back to the update text when the plain text is empty', async () => {
      respondWithMessages([update({ plainText: '', text: 'Спиране на водата в Лозенец' })])
      const payload = makePayload()

      await runTask(payload)

      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ body: 'Спиране на водата в Лозенец' })
      )
    })

    it('notifies only matching subscribers for updates with known categories', async () => {
      respondWithMessages([update({ categories: ['water', 'traffic', 'unknown'] })])
      mockMatchSubscriptions.mockResolvedValueOnce(['ExponentPushToken[a]', 'ExponentPushToken[b]'])
      const payload = makePayload({
        categories: [
          { id: 3, slug: 'water' },
          { id: 4, slug: 'traffic' },
        ],
      })

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 1 } })

      expect(payload.find).toHaveBeenCalledWith({
        collection: 'categories',
        where: { slug: { in: ['water', 'traffic', 'unknown'] } },
        limit: 50,
        overrideAccess: true,
      })
      expect(mockMatchSubscriptions).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ categories: [{ id: 3 }, { id: 4 }] })
      )
      expect(mockSendPushNotificationsToTokens).toHaveBeenCalledWith(
        payload,
        ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
        {
          title: TITLE,
          body: 'Спиране на водата в Лозенец',
          data: { type: 'update', updateId: 'u1' },
        }
      )
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('broadcasts updates whose categories are not known locally', async () => {
      respondWithMessages([update({ categories: ['unknown'] })])
      const payload = makePayload({ categories: [{ id: 3, slug: 'water' }] })

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 1 } })

      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ data: { type: 'update', updateId: 'u1' } })
      )
      expect(mockMatchSubscriptions).not.toHaveBeenCalled()
      expect(mockSendPushNotificationsToTokens).not.toHaveBeenCalled()
    })

    it('does not count updates without matching subscribers', async () => {
      respondWithMessages([update({ categories: ['water'] })])
      mockMatchSubscriptions.mockResolvedValueOnce([])

      await expect(
        runTask(makePayload({ categories: [{ id: 3, slug: 'water' }] }))
      ).resolves.toEqual({ output: { notified: 0 } })

      expect(mockSendPushNotificationsToTokens).not.toHaveBeenCalled()
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('logs a failed update and continues with the rest', async () => {
      respondWithMessages([
        update({ id: 'u1' }),
        update({ id: 'u2', categories: ['water'] }),
        update({ id: 'u3' }),
      ])
      mockSendPushNotifications.mockRejectedValueOnce(new Error('expo down'))
      mockMatchSubscriptions.mockRejectedValueOnce(new Error('db down'))
      const payload = makePayload({ categories: [{ id: 3, slug: 'water' }] })

      await expect(runTask(payload)).resolves.toEqual({ output: { notified: 1 } })

      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send notification for update u1: Error: expo down')
      )
      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send notification for update u2: Error: db down')
      )
      expect(mockSendPushNotifications).toHaveBeenLastCalledWith(
        payload,
        expect.objectContaining({ data: { type: 'update', updateId: 'u3' } })
      )
    })

    // BUG (bugs.md #2): the task always passes `location: null`, so subscribers with a district,
    // point or area filter never match an update.
    it.failing('matches subscribers against the location of the update', async () => {
      respondWithMessages([
        update({
          categories: ['water'],
          geoJson: {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', geometry: { type: 'Point', coordinates: [23.33, 42.69] } },
            ],
          },
          pins: [{ address: 'ул. Шипка 1', coordinates: { lat: 42.69, lng: 23.33 } }],
        }),
      ])
      mockMatchSubscriptions.mockResolvedValueOnce([])
      const payload = makePayload({ categories: [{ id: 3, slug: 'water' }] })

      await runTask(payload)

      expect(mockMatchSubscriptions).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ location: { latitude: 42.69, longitude: 23.33 } })
      )
    })

    // BUG (bugs.md #3): the body is built before the per-update try/catch, so an update without
    // text stops the whole run after the checkpoint has already moved on.
    it.failing('keeps sending the remaining updates when one has no text', async () => {
      respondWithMessages([
        update({ id: 'u1', text: undefined, plainText: undefined }),
        update({ id: 'u2' }),
      ])
      const payload = makePayload()

      await expect(runTask(payload)).resolves.toBeDefined()

      expect(mockSendPushNotifications).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ data: { type: 'update', updateId: 'u2' } })
      )
    })
  })
})
