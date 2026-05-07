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

// Pull the afterRead hook directly from the collection config
const afterReadHooks = Signals.hooks?.afterRead as Array<(...args: any[]) => any> | undefined
if (!afterReadHooks?.[0]) throw new Error('Signals.hooks.afterRead[0] is not defined')
const afterReadHook = afterReadHooks[0]

// canUpdate is private; test it through Signals.access.update
const canUpdate = Signals.access!.update as (...args: any[]) => Promise<boolean>

// ---------------------------------------------------------------------------
// afterRead hook — reporterUniqueId IDOR protection
// ---------------------------------------------------------------------------

describe('Signals afterRead hook — reporterUniqueId redaction', () => {
  it('strips reporterUniqueId for unauthenticated requests', () => {
    const doc: any = { id: '1', title: 'Test', reporterUniqueId: 'SECRET-UUID' }
    const result = afterReadHook({ doc, req: { user: null } })
    expect(result.reporterUniqueId).toBeUndefined()
  })

  it('strips reporterUniqueId for regular (non-admin) users', () => {
    const doc: any = { id: '1', title: 'Test', reporterUniqueId: 'SECRET-UUID' }
    const result = afterReadHook({ doc, req: { user: { role: 'user' } } })
    expect(result.reporterUniqueId).toBeUndefined()
  })

  it('strips reporterUniqueId for inspector role', () => {
    const doc: any = { id: '1', title: 'Test', reporterUniqueId: 'SECRET-UUID' }
    const result = afterReadHook({ doc, req: { user: { role: 'inspector' } } })
    expect(result.reporterUniqueId).toBeUndefined()
  })

  it('preserves reporterUniqueId for admin users', () => {
    const doc: any = { id: '1', title: 'Test', reporterUniqueId: 'SECRET-UUID' }
    const result = afterReadHook({ doc, req: { user: { role: 'admin' } } })
    expect(result.reporterUniqueId).toBe('SECRET-UUID')
  })

  it('handles documents without reporterUniqueId gracefully', () => {
    const doc: any = { id: '1', title: 'Test' }
    const result = afterReadHook({ doc, req: { user: null } })
    expect(result.reporterUniqueId).toBeUndefined()
    expect(result.title).toBe('Test')
  })

  it('returns the mutated doc object', () => {
    const doc: any = { id: '1', reporterUniqueId: 'X' }
    const result = afterReadHook({ doc, req: { user: { role: 'user' } } })
    expect(result).toBe(doc)
  })
})

// ---------------------------------------------------------------------------
// reporterUniqueId field definition
// ---------------------------------------------------------------------------

describe('Signals reporterUniqueId field definition', () => {
  const field = (Signals.fields as any[]).find((f: any) => f.name === 'reporterUniqueId')

  it('field exists in the collection', () => {
    expect(field).toBeDefined()
  })

  it('is of type text', () => {
    expect(field?.type).toBe('text')
  })

  it('is indexed (required for where-query performance)', () => {
    expect(field?.index).toBe(true)
  })

  it('does NOT have a field-level read access restriction (queries must not be blocked)', () => {
    // The read restriction was moved to the afterRead hook so that
    // non-admins can still filter ?where[reporterUniqueId][equals]=... queries.
    expect(field?.access?.read).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// canUpdate access — reporterUniqueId ownership verification
// ---------------------------------------------------------------------------

describe('Signals canUpdate access — reporterUniqueId ownership', () => {
  it('grants access when reporterUniqueId in request matches stored signal (overrideAccess used)', async () => {
    const UNIQUE_ID = 'TEST-UUID-123'
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({ id: '42', reporterUniqueId: UNIQUE_ID }),
    })
    const req = { user: null, payload } as any
    const result = await canUpdate({ req, data: { reporterUniqueId: UNIQUE_ID }, id: '42' })
    expect(result).toBe(true)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true, collection: 'signals', id: '42' })
    )
  })

  it('denies access when reporterUniqueId does not match stored signal', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({ id: '42', reporterUniqueId: 'DIFFERENT-UUID' }),
    })
    const req = { user: null, payload } as any
    const result = await canUpdate({ req, data: { reporterUniqueId: 'WRONG-UUID' }, id: '42' })
    expect(result).toBe(false)
  })

  it('denies access when no reporterUniqueId is provided in the update data', async () => {
    const payload = makePayload({ findByID: jest.fn() })
    const req = { user: null, payload } as any
    const result = await canUpdate({ req, data: { title: 'changed' }, id: '42' })
    expect(result).toBe(false)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('denies access and logs error when findByID throws', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const req = { user: null, payload } as any
    const result = await canUpdate({ req, data: { reporterUniqueId: 'X' }, id: '99' })
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
