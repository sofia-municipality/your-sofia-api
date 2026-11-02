import type { PayloadRequest } from 'payload'
import { submitMissionForReview } from '../submitMissionForReview'

type ErrorBody = { error: string }
type TaskRow = {
  id: string
  beforePhoto?: number
  afterPhoto?: number
  requiresBeforePhoto?: boolean
  requiresAfterPhoto?: boolean
}
type MissionDoc = {
  id: number
  citizen: number | { id: number | string } | null
  status: string
  tasks: TaskRow[]
  missionBeforePhotos: number[]
  missionAfterPhotos: number[]
}
type UpdateArgs = { id: string; data: Record<string, unknown> }

const makeMission = (overrides: Partial<MissionDoc> = {}): MissionDoc => ({
  id: 10,
  citizen: 5,
  status: 'in_progress',
  tasks: [{ id: 't1', beforePhoto: 101, afterPhoto: 102 }],
  missionBeforePhotos: [201],
  missionAfterPhotos: [202],
  ...overrides,
})

const makePayload = (mission: MissionDoc | null) => ({
  findByID: jest.fn(async () => mission),
  update: jest.fn(async ({ id, data }: UpdateArgs) => ({ ...mission, id, ...data })),
  logger: { error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, overrides: Record<string, unknown> = {}) =>
  ({
    payload,
    user: { id: 5 },
    routeParams: { id: '10' },
    ...overrides,
  }) as unknown as PayloadRequest

describe('submitMissionForReview endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionForReview.handler(makeReq(payload, { user: null }))
    expect(res.status).toBe(401)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('returns 400 when mission id is missing', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionForReview.handler(makeReq(payload, { routeParams: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when mission does not exist', async () => {
    const payload = makePayload(null)
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(404)
  })

  it('returns 403 when the mission belongs to another citizen', async () => {
    const payload = makePayload(makeMission({ citizen: { id: 6 } }))
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(403)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 403 when the mission has no assigned citizen', async () => {
    const payload = makePayload(makeMission({ citizen: null }))
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(403)
  })

  it('returns 409 when the mission is not in an editable state', async () => {
    const payload = makePayload(makeMission({ status: 'ready_for_review' }))
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(409)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 400 when a task is missing a required photo', async () => {
    const payload = makePayload(
      makeMission({ tasks: [{ id: 't1', beforePhoto: 101, afterPhoto: 102 }, { id: 't2' }] })
    )
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(400)
    const body: ErrorBody = await res.json()
    expect(body.error).toMatch(/task photos/)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 400 when overall mission before/after photos are missing', async () => {
    const payload = makePayload(makeMission({ missionAfterPhotos: [] }))
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(400)
    const body: ErrorBody = await res.json()
    expect(body.error).toMatch(/before\/after photos/)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('marks the mission ready for review', async () => {
    const payload = makePayload(makeMission())

    const res = await submitMissionForReview.handler(makeReq(payload))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      mission: { status: 'ready_for_review' },
    })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'missions',
      id: '10',
      data: { status: 'ready_for_review' },
      overrideAccess: true,
    })
  })

  it('accepts a populated citizen and a returned_for_improvement mission', async () => {
    const payload = makePayload(
      makeMission({ citizen: { id: '5' }, status: 'returned_for_improvement' })
    )
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(200)
  })

  it('skips photos that a task does not require', async () => {
    const payload = makePayload(
      makeMission({
        tasks: [{ id: 't1', requiresBeforePhoto: false, requiresAfterPhoto: false }],
      })
    )
    const res = await submitMissionForReview.handler(makeReq(payload))
    expect(res.status).toBe(200)
  })

  it('returns 500 and logs when the update fails', async () => {
    const payload = makePayload(makeMission())
    payload.update.mockRejectedValue(new Error('db down'))

    const res = await submitMissionForReview.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('mission 10'))
  })
})
