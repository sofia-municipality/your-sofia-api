// @payloadcms/db-postgres uses ESM — mock the sql tag so Jest can parse it
jest.mock('@payloadcms/db-postgres', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}))

// Mock push notifications utility to avoid expo-server-sdk ESM issues
jest.mock('../../utilities/pushNotifications', () => ({
  sendPushNotificationsToTokens: jest.fn(),
}))

// payload uses ESM — mock it so Jest can import Signals/index.ts without transform errors
jest.mock('payload', () => ({
  APIError: class APIError extends Error {
    constructor(
      message: string,
      public status = 500
    ) {
      super(message)
      this.name = 'APIError'
    }
  },
}))

import { Signals } from '../Signals/index'
import { sendPushNotificationsToTokens } from '../../utilities/pushNotifications'

const mockSendPush = sendPushNotificationsToTokens as jest.MockedFunction<
  typeof sendPushNotificationsToTokens
>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeReq = (role?: string) => ({
  req: {
    user: role ? { role } : null,
    payload: {
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    },
  },
})

const makePayload = (overrides?: Record<string, unknown>): any => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  ...overrides,
})

// canUpdate is private; test it through Signals.access.update
const canUpdate = Signals.access!.update as (...args: any[]) => Promise<boolean>

// ---------------------------------------------------------------------------
// canUpdate access — authenticated user ownership
// ---------------------------------------------------------------------------

describe('Signals canUpdate access — authenticated user ownership', () => {
  it('grants access to city infrastructure admins regardless of ownership', async () => {
    const payload = makePayload({ findByID: jest.fn() })
    const req = { user: { role: 'inspector' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('denies access when user is unauthenticated', async () => {
    const payload = makePayload({ findByID: jest.fn() })
    const req = { user: null, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(false)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('denies access when id is missing', async () => {
    const payload = makePayload({ findByID: jest.fn() })
    const req = { user: { id: 1, role: 'user' }, payload } as any
    const result = await canUpdate({ req, id: undefined })
    expect(result).toBe(false)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('grants access when authenticated user is the reporter', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({ id: '42', reporter: 7 }),
    })
    const req = { user: { id: 7, role: 'user' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true, collection: 'signals', id: '42' })
    )
  })

  it('denies access when authenticated user is not the reporter', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({ id: '42', reporter: 99 }),
    })
    const req = { user: { id: 7, role: 'user' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(false)
  })

  it('denies access and logs error when findByID throws', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const req = { user: { id: 7, role: 'user' }, payload } as any
    const result = await canUpdate({ req, id: '99' })
    expect(result).toBe(false)
    expect(payload.logger.error).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// afterChange hook — signal-closed push notification
// ---------------------------------------------------------------------------

const afterChangeHooks = Signals.hooks?.afterChange as Array<(...args: any[]) => any> | undefined
// The second afterChange hook handles push notifications on status transitions
const signalClosedHook = afterChangeHooks?.[1]
if (!signalClosedHook) throw new Error('Signals.hooks.afterChange[1] is not defined')

const makeClosedHookPayload = (findOverride?: object) =>
  makePayload({
    find: jest.fn().mockResolvedValue({ docs: [] }),
    ...findOverride,
  })

describe('Signals afterChange hook — signal-closed notification', () => {
  beforeEach(() => {
    mockSendPush.mockClear()
  })

  it('skips notification on create operation', async () => {
    const payload = makeClosedHookPayload()
    const doc = { id: '1', title: 'T', status: 'resolved', reporterUniqueId: 'X' }
    await signalClosedHook({ doc, req: { payload }, previousDoc: null, operation: 'create' })
    expect(payload.find).not.toHaveBeenCalled()
    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('skips notification when status has not changed', async () => {
    const payload = makeClosedHookPayload()
    const doc = { id: '1', title: 'T', status: 'resolved', reporterUniqueId: 'X' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'resolved' },
      operation: 'update',
    })
    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('skips notification when new status is not closed', async () => {
    const payload = makeClosedHookPayload()
    const doc = { id: '1', title: 'T', status: 'in-progress', reporterUniqueId: 'X' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'pending' },
      operation: 'update',
    })
    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('skips notification when reporterUniqueId is absent', async () => {
    const payload = makeClosedHookPayload()
    const doc = { id: '1', title: 'T', status: 'resolved' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'pending' },
      operation: 'update',
    })
    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('logs info and skips push when no active tokens found', async () => {
    const payload = makeClosedHookPayload({ find: jest.fn().mockResolvedValue({ docs: [] }) })
    const doc = { id: '1', title: 'Broken light', status: 'resolved', reporterUniqueId: 'R1' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'pending' },
      operation: 'update',
    })
    expect(mockSendPush).not.toHaveBeenCalled()
    expect(payload.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('No active push token')
    )
  })

  it('sends push notification when signal transitions to resolved', async () => {
    mockSendPush.mockResolvedValue(undefined as any)
    const payload = makeClosedHookPayload({
      find: jest.fn().mockResolvedValue({ docs: [{ token: 'ExponentPushToken[abc]' }] }),
    })
    const doc = { id: '42', title: 'Broken light', status: 'resolved', reporterUniqueId: 'R1' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'in-progress' },
      operation: 'update',
    })
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'push-tokens',
        overrideAccess: true,
      })
    )
    expect(mockSendPush).toHaveBeenCalledWith(
      payload,
      ['ExponentPushToken[abc]'],
      expect.objectContaining({
        title: 'Сигналът ви е приключен',
        body: expect.stringContaining('Благодарим за вашия принос'),
        data: expect.objectContaining({
          type: 'signal-status-update',
          signalId: '42',
          status: 'resolved',
        }),
      })
    )
  })

  it('sends push notification when signal transitions to rejected', async () => {
    mockSendPush.mockResolvedValue(undefined as any)
    const payload = makeClosedHookPayload({
      find: jest.fn().mockResolvedValue({ docs: [{ token: 'ExponentPushToken[xyz]' }] }),
    })
    const doc = { id: '7', title: 'Pothole', status: 'rejected', reporterUniqueId: 'R2' }
    await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'pending' },
      operation: 'update',
    })
    expect(mockSendPush).toHaveBeenCalledWith(
      payload,
      ['ExponentPushToken[xyz]'],
      expect.objectContaining({
        title: 'Сигналът ви е отхвърлен',
        body: expect.stringContaining('не може да бъде изпълнен'),
        data: expect.objectContaining({
          type: 'signal-status-update',
          signalId: '7',
          status: 'rejected',
        }),
      })
    )
  })

  it('logs error and does not throw when push delivery fails', async () => {
    mockSendPush.mockRejectedValue(new Error('Expo down'))
    const payload = makeClosedHookPayload({
      find: jest.fn().mockResolvedValue({ docs: [{ token: 'ExponentPushToken[abc]' }] }),
    })
    const doc = { id: '5', title: 'T', status: 'resolved', reporterUniqueId: 'R3' }
    await expect(
      signalClosedHook({
        doc,
        req: { payload },
        previousDoc: { status: 'pending' },
        operation: 'update',
      })
    ).resolves.toBe(doc)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send signal-status-update notification')
    )
  })

  it('returns the doc regardless of outcome', async () => {
    const payload = makeClosedHookPayload()
    const doc = { id: '1', title: 'T', status: 'pending', reporterUniqueId: 'R4' }
    const result = await signalClosedHook({
      doc,
      req: { payload },
      previousDoc: { status: 'pending' },
      operation: 'update',
    })
    expect(result).toBe(doc)
  })
})
