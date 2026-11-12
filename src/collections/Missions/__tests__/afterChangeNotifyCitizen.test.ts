// Mock push notifications utility to avoid expo-server-sdk ESM issues
jest.mock('../../../utilities/pushNotifications', () => ({
  sendPushNotificationsToTokens: jest.fn(),
}))

import { sendPushNotificationsToTokens } from '../../../utilities/pushNotifications'
import { afterChangeNotifyCitizen } from '../hooks/afterChangeNotifyCitizen'

const mockSendPush = jest.mocked(sendPushNotificationsToTokens)

type MissionDoc = { id: number; status: string; citizen?: number | { id?: number } | null }
type HookArgs = { doc: MissionDoc; previousDoc?: MissionDoc; operation: 'create' | 'update' }

const makePayload = (tokens: string[] = ['ExponentPushToken[abc]']) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: tokens.map((token) => ({ token })) })),
  logger: { info: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runHook = (payload: MockPayload, args: HookArgs): Promise<MissionDoc> =>
  afterChangeNotifyCitizen({ ...args, req: { payload } } as unknown as Parameters<
    typeof afterChangeNotifyCitizen
  >[0])

// The hook sends the push in a fire-and-forget task; let it settle before asserting.
const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve))

const previousDoc: MissionDoc = { id: 10, status: 'ready_for_review', citizen: 5 }

describe('afterChangeNotifyCitizen hook (unit)', () => {
  it('skips creates', async () => {
    const payload = makePayload()
    const doc = { id: 10, status: 'completed', citizen: 5 }

    await expect(runHook(payload, { doc, operation: 'create' })).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.find).not.toHaveBeenCalled()
  })

  it('skips updates that do not move the mission into a notified status', async () => {
    const transitions: Array<[string, string]> = [
      ['completed', 'completed'],
      ['in_progress', 'ready_for_review'],
      ['open', 'in_progress'],
      ['ready_for_review', 'cancelled'],
    ]

    for (const [previousStatus, status] of transitions) {
      const payload = makePayload()
      await runHook(payload, {
        doc: { id: 10, status, citizen: 5 },
        previousDoc: { id: 10, status: previousStatus, citizen: 5 },
        operation: 'update',
      })
      await flushBackgroundWork()
      expect(payload.find).not.toHaveBeenCalled()
    }
  })

  it('skips missions without a citizen', async () => {
    for (const citizen of [null, {}]) {
      const payload = makePayload()
      await runHook(payload, {
        doc: { id: 10, status: 'completed', citizen },
        previousDoc,
        operation: 'update',
      })
      await flushBackgroundWork()
      expect(payload.find).not.toHaveBeenCalled()
    }
  })

  it("sends an approval notification to the citizen's active devices when a mission is completed", async () => {
    const payload = makePayload(['ExponentPushToken[abc]', 'ExponentPushToken[def]'])
    const doc = { id: 10, status: 'completed', citizen: 5 }

    await expect(runHook(payload, { doc, previousDoc, operation: 'update' })).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'push-tokens',
      where: { and: [{ user: { equals: 5 } }, { active: { equals: true } }] },
      limit: 10,
      overrideAccess: true,
    })
    expect(mockSendPush).toHaveBeenCalledWith(
      payload,
      ['ExponentPushToken[abc]', 'ExponentPushToken[def]'],
      {
        title: 'Мисията е одобрена! 🎉',
        body: expect.stringContaining('одобри изпълнението'),
        data: { type: 'mission-status-update', missionId: '10', status: 'completed' },
      }
    )
  })

  it('sends an improvement notification when a mission is returned', async () => {
    const payload = makePayload()

    await runHook(payload, {
      doc: { id: 10, status: 'returned_for_improvement', citizen: { id: 5 } },
      previousDoc,
      operation: 'update',
    })
    await flushBackgroundWork()

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { and: [{ user: { equals: 5 } }, { active: { equals: true } }] },
      })
    )
    expect(mockSendPush).toHaveBeenCalledWith(payload, ['ExponentPushToken[abc]'], {
      title: 'Мисията се нуждае от подобрение',
      body: expect.stringContaining('върна мисията'),
      data: { type: 'mission-status-update', missionId: '10', status: 'returned_for_improvement' },
    })
  })

  it('does not send anything when the citizen has no active push token', async () => {
    for (const tokens of [[], ['']]) {
      const payload = makePayload(tokens)
      await runHook(payload, {
        doc: { id: 10, status: 'completed', citizen: 5 },
        previousDoc,
        operation: 'update',
      })
      await flushBackgroundWork()
      expect(payload.find).toHaveBeenCalled()
      expect(mockSendPush).not.toHaveBeenCalled()
    }
  })

  it('logs push delivery failures without failing the save', async () => {
    mockSendPush.mockRejectedValueOnce(new Error('expo down'))
    const payload = makePayload()
    const doc = { id: 10, status: 'completed', citizen: 5 }

    await expect(runHook(payload, { doc, previousDoc, operation: 'update' })).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.logger.error).toHaveBeenCalled()
  })
})
