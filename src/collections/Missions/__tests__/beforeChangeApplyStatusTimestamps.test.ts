import { beforeChangeApplyStatusTimestamps } from '../hooks/beforeChangeApplyStatusTimestamps'

type MissionData = {
  status?: string
  claimedAt?: string
  submittedForReviewAt?: string
  reviewedAt?: string
  completedAt?: string
  pointsAwarded?: number
  pointsReward?: number
}
type HookArgs = { data?: MissionData; originalDoc?: MissionData; operation: 'create' | 'update' }

const NOW = '2026-03-15T10:30:00.000Z'

const runHook = ({ data, originalDoc, operation }: HookArgs): MissionData | undefined =>
  beforeChangeApplyStatusTimestamps({
    data,
    originalDoc,
    operation,
    req: { payload: { logger: { info: jest.fn() } } },
  } as unknown as Parameters<typeof beforeChangeApplyStatusTimestamps>[0])

describe('beforeChangeApplyStatusTimestamps hook (unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(NOW) })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('ignores creates and updates without the original doc', () => {
    expect(runHook({ data: { status: 'completed' }, operation: 'create' })).toEqual({
      status: 'completed',
    })
    expect(runHook({ data: { status: 'completed' }, operation: 'update' })).toEqual({
      status: 'completed',
    })
  })

  it('does nothing when the status does not change', () => {
    expect(
      runHook({ data: { status: 'open' }, originalDoc: { status: 'open' }, operation: 'update' })
    ).toEqual({ status: 'open' })
    // An update without a status keeps the current one
    expect(runHook({ data: {}, originalDoc: { status: 'open' }, operation: 'update' })).toEqual({})
  })

  it('sets claimedAt when a mission is claimed', () => {
    expect(
      runHook({
        data: { status: 'in_progress' },
        originalDoc: { status: 'open' },
        operation: 'update',
      })
    ).toEqual({ status: 'in_progress', claimedAt: NOW })
  })

  it('keeps an existing claimedAt', () => {
    expect(
      runHook({
        data: { status: 'in_progress' },
        originalDoc: { status: 'returned_for_improvement', claimedAt: '2026-01-01T00:00:00.000Z' },
        operation: 'update',
      })
    ).toEqual({ status: 'in_progress' })
    expect(
      runHook({
        data: { status: 'in_progress', claimedAt: '2026-02-01T00:00:00.000Z' },
        originalDoc: { status: 'open' },
        operation: 'update',
      })
    ).toEqual({ status: 'in_progress', claimedAt: '2026-02-01T00:00:00.000Z' })
  })

  it('sets submittedForReviewAt on every submission for review', () => {
    expect(
      runHook({
        data: { status: 'ready_for_review' },
        originalDoc: { status: 'returned_for_improvement', submittedForReviewAt: 'earlier' },
        operation: 'update',
      })
    ).toEqual({ status: 'ready_for_review', submittedForReviewAt: NOW })
  })

  it('sets reviewedAt when a mission is returned for improvement', () => {
    expect(
      runHook({
        data: { status: 'returned_for_improvement' },
        originalDoc: { status: 'ready_for_review' },
        operation: 'update',
      })
    ).toEqual({ status: 'returned_for_improvement', reviewedAt: NOW })
  })

  it('sets reviewedAt, completedAt and pointsAwarded when a mission is completed', () => {
    expect(
      runHook({
        data: { status: 'completed', pointsReward: 15 },
        originalDoc: { status: 'ready_for_review', pointsReward: 10 },
        operation: 'update',
      })
    ).toEqual({
      status: 'completed',
      pointsReward: 15,
      reviewedAt: NOW,
      completedAt: NOW,
      pointsAwarded: 15,
    })
  })

  it("falls back to the original doc's pointsReward", () => {
    const result = runHook({
      data: { status: 'completed' },
      originalDoc: { status: 'ready_for_review', pointsReward: 10 },
      operation: 'update',
    })
    expect(result?.pointsAwarded).toBe(10)
  })

  it('keeps points that were already awarded', () => {
    expect(
      runHook({
        data: { status: 'completed', pointsReward: 15 },
        originalDoc: { status: 'returned_for_improvement', pointsAwarded: 8 },
        operation: 'update',
      })
    ).not.toHaveProperty('pointsAwarded')
    expect(
      runHook({
        data: { status: 'completed', pointsAwarded: 3, pointsReward: 15 },
        originalDoc: { status: 'ready_for_review' },
        operation: 'update',
      })?.pointsAwarded
    ).toBe(3)
  })
})
