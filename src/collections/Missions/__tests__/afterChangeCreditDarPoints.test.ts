jest.mock('../../../utilities/missionProfiles', () => ({
  getOrCreateMissionProfile: jest.fn(),
}))

import { getOrCreateMissionProfile } from '../../../utilities/missionProfiles'
import { afterChangeCreditDarPoints } from '../hooks/afterChangeCreditDarPoints'

const mockGetOrCreateMissionProfile = jest.mocked(getOrCreateMissionProfile)

type MissionDoc = {
  id: number
  status: string
  citizen?: number | { id?: number } | null
  pointsAwarded?: number | null
  pointsReward?: number | null
  completedAt?: string | null
  reviewedAt?: string | null
}
type HookArgs = { doc: MissionDoc; previousDoc?: MissionDoc; operation: 'create' | 'update' }

const makePayload = () => ({
  create: jest.fn(async (_args: unknown): Promise<unknown> => ({ id: 1 })),
  update: jest.fn(async (_args: unknown): Promise<unknown> => ({ id: 'p1' })),
  logger: { info: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runHook = (payload: MockPayload, args: HookArgs): Promise<MissionDoc> =>
  afterChangeCreditDarPoints({ ...args, req: { payload } } as unknown as Parameters<
    typeof afterChangeCreditDarPoints
  >[0])

// The ledger and balance writes run in a fire-and-forget task; let it settle before asserting.
const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve))

const COMPLETED_AT = '2026-03-15T10:00:00.000Z'
const REVIEWED_AT = '2026-03-20T09:00:00.000Z'

const completedMission = (overrides: Partial<MissionDoc> = {}): MissionDoc => ({
  id: 10,
  status: 'completed',
  citizen: 5,
  pointsAwarded: 15,
  completedAt: COMPLETED_AT,
  ...overrides,
})

const readyForReview: MissionDoc = { id: 10, status: 'ready_for_review', citizen: 5 }

describe('afterChangeCreditDarPoints hook (unit)', () => {
  beforeEach(() => {
    mockGetOrCreateMissionProfile.mockResolvedValue({
      id: 'p1',
      user: 5,
      darPoints: 20,
      contributorLevel: 'beginner',
    })
  })

  it('skips creates', async () => {
    const payload = makePayload()
    const doc = completedMission()

    await expect(runHook(payload, { doc, operation: 'create' })).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.create).not.toHaveBeenCalled()
  })

  it('skips updates that neither complete nor return a completed mission', async () => {
    const transitions: Array<[string, string]> = [
      ['in_progress', 'ready_for_review'],
      ['completed', 'completed'],
      ['ready_for_review', 'returned_for_improvement'],
      ['completed', 'cancelled'],
    ]

    for (const [previousStatus, status] of transitions) {
      const payload = makePayload()
      await runHook(payload, {
        doc: completedMission({ status }),
        previousDoc: { ...readyForReview, status: previousStatus },
        operation: 'update',
      })
      await flushBackgroundWork()
      expect(payload.create).not.toHaveBeenCalled()
    }
  })

  it('skips missions without points or without a citizen', async () => {
    const docs = [
      completedMission({ pointsAwarded: null, pointsReward: null }),
      // pointsAwarded wins over pointsReward, even when it is zero
      completedMission({ pointsAwarded: 0, pointsReward: 10 }),
      completedMission({ citizen: null }),
      completedMission({ citizen: {} }),
    ]

    for (const doc of docs) {
      const payload = makePayload()
      await runHook(payload, { doc, previousDoc: readyForReview, operation: 'update' })
      await flushBackgroundWork()
      expect(payload.create).not.toHaveBeenCalled()
    }
  })

  it('records a ledger entry and credits the citizen when a mission is completed', async () => {
    const payload = makePayload()
    const doc = completedMission()

    await expect(
      runHook(payload, { doc, previousDoc: readyForReview, operation: 'update' })
    ).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'dar-points-transactions',
      data: {
        idempotencyKey: `mission-completed:10:5:${COMPLETED_AT}`,
        user: 5,
        amount: 15,
        reason: 'mission_completed',
        mission: 10,
      },
      overrideAccess: true,
    })
    expect(mockGetOrCreateMissionProfile).toHaveBeenCalledWith(payload, 5)
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'mission-profiles',
      id: 'p1',
      data: { darPoints: 35 },
      overrideAccess: true,
    })
  })

  it('falls back to pointsReward when no points were awarded explicitly', async () => {
    const payload = makePayload()

    await runHook(payload, {
      doc: completedMission({ pointsAwarded: null, pointsReward: 10 }),
      previousDoc: readyForReview,
      operation: 'update',
    })
    await flushBackgroundWork()

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 10 }) })
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { darPoints: 30 } })
    )
  })

  it('uses the current time in the idempotency key when completedAt is missing', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1773570600000)
    const payload = makePayload()

    await runHook(payload, {
      doc: completedMission({ completedAt: null }),
      previousDoc: readyForReview,
      operation: 'update',
    })
    await flushBackgroundWork()
    nowSpy.mockRestore()

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: 'mission-completed:10:5:1773570600000' }),
      })
    )
  })

  it('debits the citizen when a completed mission is returned for improvement', async () => {
    const payload = makePayload()

    await runHook(payload, {
      doc: completedMission({
        status: 'returned_for_improvement',
        citizen: { id: 5 },
        reviewedAt: REVIEWED_AT,
      }),
      previousDoc: completedMission(),
      operation: 'update',
    })
    await flushBackgroundWork()

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'dar-points-transactions',
      data: {
        idempotencyKey: `mission-returned:10:5:${REVIEWED_AT}`,
        user: 5,
        amount: -15,
        reason: 'mission_returned',
        mission: 10,
      },
      overrideAccess: true,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: { darPoints: 5 } }))
  })

  it('does not adjust the balance again when the transition was already recorded', async () => {
    const duplicateKeyErrors = [
      Object.assign(new Error('insert failed'), { code: '23505' }),
      new Error('duplicate key value violates unique constraint "idempotency_key_idx"'),
      new Error('IdempotencyKey must be unique'),
    ]

    for (const error of duplicateKeyErrors) {
      const payload = makePayload()
      payload.create.mockRejectedValueOnce(error)

      await runHook(payload, {
        doc: completedMission(),
        previousDoc: readyForReview,
        operation: 'update',
      })
      await flushBackgroundWork()

      expect(payload.update).not.toHaveBeenCalled()
      expect(payload.logger.error).not.toHaveBeenCalled()
    }
    expect(mockGetOrCreateMissionProfile).not.toHaveBeenCalled()
  })

  it('logs other ledger failures without touching the balance', async () => {
    const payload = makePayload()
    payload.create.mockRejectedValueOnce(new Error('connection reset'))

    await runHook(payload, {
      doc: completedMission(),
      previousDoc: readyForReview,
      operation: 'update',
    })
    await flushBackgroundWork()

    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('connection reset'))
  })

  it('logs balance update failures without failing the save', async () => {
    const payload = makePayload()
    payload.update.mockRejectedValueOnce(new Error('db down'))
    const doc = completedMission()

    await expect(
      runHook(payload, { doc, previousDoc: readyForReview, operation: 'update' })
    ).resolves.toBe(doc)
    await flushBackgroundWork()

    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
