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
import { beforeValidateSignal } from '../Signals/hooks/beforeValidateSignal'
import { sendPushNotificationsToTokens } from '../../utilities/pushNotifications'

const mockSendPush = sendPushNotificationsToTokens as jest.MockedFunction<
  typeof sendPushNotificationsToTokens
>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  it('grants city infrastructure admins access to non-fountain signals regardless of ownership', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({
        id: '42',
        category: 'waste-container',
        cityObject: { type: 'waste-container', referenceId: 'RTR-0042' },
        reporter: 99,
      }),
    })
    const req = { user: { id: 7, role: 'inspector' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
  })

  it('grants admin access to any signal without a lookup', async () => {
    const payload = makePayload({ findByID: jest.fn() })
    const req = { user: { id: 1, role: 'admin' }, payload } as any
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

  it('grants inspector access to fountain signals', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({
        id: '42',
        category: 'drinking-fountain',
        reporter: 99,
      }),
    })
    const req = { user: { id: 7, role: 'inspector' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
  })

  it('denies containerAdmin access to fountain signals they did not report', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({
        id: '42',
        category: 'drinking-fountain',
        cityObject: { type: 'drinking-fountain', referenceId: 'DF-RTR-0001' },
        reporter: 99,
      }),
    })
    const req = { user: { id: 7, role: 'containerAdmin' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(false)
  })

  it('grants fountainAdmin access to fountain-category signals', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({ id: '42', category: 'drinking-fountain' }),
    })
    const req = { user: { id: 7, role: 'fountainAdmin' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
  })

  it('grants fountainAdmin access to signals referencing a fountain city object', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({
        id: '42',
        category: 'other',
        cityObject: { type: 'drinking-fountain', referenceId: 'DF-RTR-0001' },
      }),
    })
    const req = { user: { id: 7, role: 'fountainAdmin' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(true)
  })

  it('denies fountainAdmin access to non-fountain signals they did not report', async () => {
    const payload = makePayload({
      findByID: jest.fn().mockResolvedValue({
        id: '42',
        category: 'waste-container',
        cityObject: { type: 'waste-container', referenceId: 'RTR-0042' },
        reporter: 99,
      }),
    })
    const req = { user: { id: 7, role: 'fountainAdmin' }, payload } as any
    const result = await canUpdate({ req, id: '42' })
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// read access — fountain admins are limited to fountain signals
// ---------------------------------------------------------------------------

const canRead = Signals.access!.read as (...args: any[]) => unknown

describe('Signals read access', () => {
  it('limits fountainAdmin to fountain signals', () => {
    expect(canRead({ req: { user: { role: 'fountainAdmin' } } })).toEqual({
      or: [
        { category: { equals: 'drinking-fountain' } },
        { 'cityObject.type': { equals: 'drinking-fountain' } },
      ],
    })
  })

  it('limits containerAdmin to waste-container signals', () => {
    expect(canRead({ req: { user: { role: 'containerAdmin' } } })).toEqual({
      or: [
        { category: { equals: 'waste-container' } },
        { 'cityObject.type': { equals: 'waste-container' } },
      ],
    })
  })

  it('does not restrict other authenticated roles', () => {
    expect(canRead({ req: { user: { role: 'inspector' } } })).toBe(true)
    expect(canRead({ req: { user: { role: 'admin' } } })).toBe(true)
  })

  it('does not restrict public (unauthenticated) reads', () => {
    expect(canRead({ req: { user: null } })).toBe(true)
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

// ---------------------------------------------------------------------------
// beforeValidate hook — duplicate active-signal check (containers & fountains)
// ---------------------------------------------------------------------------

describe('Signals beforeValidate hook — duplicate signal check', () => {
  // The hook issues two kinds of payload.find calls on the signals collection:
  // the daily rate-limit count (filters on createdAt) and the duplicate lookup
  // (filters on category). Route them apart by inspecting the where clause.
  const makeDuplicateAwarePayload = (duplicateDocs: unknown[]) =>
    makePayload({
      find: jest.fn().mockImplementation(({ where }: any) => {
        const clauses: any[] = where?.and ?? []
        if (clauses.some((c) => c.createdAt)) {
          return Promise.resolve({ totalDocs: 0, docs: [] })
        }
        return Promise.resolve({ docs: duplicateDocs, totalDocs: duplicateDocs.length })
      }),
    })

  const makeSignalData = (overrides?: Record<string, unknown>) => ({
    title: 'T',
    category: 'drinking-fountain',
    reporterUniqueId: 'R1',
    cityObject: { type: 'drinking-fountain', referenceId: 'DF-RTR-0001' },
    ...overrides,
  })

  const runHook = (data: Record<string, unknown>, payload: any) =>
    beforeValidateSignal({
      data,
      req: { user: { role: 'user' }, payload },
      operation: 'create',
    } as any)

  it('rejects a fountain signal when the reporter already has an active one for the fountain', async () => {
    const payload = makeDuplicateAwarePayload([{ id: '11' }])
    await expect(runHook(makeSignalData(), payload)).rejects.toThrow(
      'Signal for same object already exists'
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'signals',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { category: { equals: 'drinking-fountain' } },
            { 'cityObject.referenceId': { equals: 'DF-RTR-0001' } },
            { status: { not_in: ['resolved', 'rejected'] } },
          ]),
        }),
      })
    )
  })

  it('allows a fountain signal when the reporter has no active signal for the fountain', async () => {
    const payload = makeDuplicateAwarePayload([])
    const data = makeSignalData()
    await expect(runHook(data, payload)).resolves.toBe(data)
  })

  it('rejects a duplicate waste-container signal (existing behaviour)', async () => {
    const payload = makeDuplicateAwarePayload([{ id: '22' }])
    const data = makeSignalData({
      category: 'waste-container',
      cityObject: { type: 'waste-container', referenceId: 'RTR-0042' },
    })
    await expect(runHook(data, payload)).rejects.toThrow('Signal for same object already exists')
  })

  it('skips the duplicate lookup for categories without referenced objects', async () => {
    const payload = makeDuplicateAwarePayload([{ id: '33' }])
    const data = makeSignalData({ category: 'other' })
    await expect(runHook(data, payload)).resolves.toBe(data)
    // Only the rate-limit count may query signals; no duplicate lookup by category
    const duplicateCalls = (payload.find as jest.Mock).mock.calls.filter((call) =>
      (call[0]?.where?.and ?? []).some((c: any) => c.category)
    )
    expect(duplicateCalls).toHaveLength(0)
  })
})
