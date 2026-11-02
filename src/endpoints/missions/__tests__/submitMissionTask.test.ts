import type { PayloadRequest } from 'payload'
import { submitMissionTask } from '../submitMissionTask'

type TaskRow = { id: string; title: string; beforePhoto?: number; afterPhoto?: number }
type MissionDoc = {
  id: number
  citizen: number | { id: number | string } | null
  status: string
  tasks: TaskRow[]
}
type UpdateArgs = { id: string; data: Record<string, unknown> }

const makeMission = (overrides: Partial<MissionDoc> = {}): MissionDoc => ({
  id: 10,
  citizen: 5,
  status: 'in_progress',
  tasks: [
    { id: 't1', title: 'Collect litter' },
    { id: 't2', title: 'Paint bench', beforePhoto: 50 },
  ],
  ...overrides,
})

const makePayload = (mission: MissionDoc | null) => ({
  findByID: jest.fn(async () => mission),
  update: jest.fn(async ({ id, data }: UpdateArgs) => ({ ...mission, id, ...data })),
  logger: { error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, body: unknown, overrides: Record<string, unknown> = {}) =>
  ({
    payload,
    user: { id: 5 },
    routeParams: { id: '10' },
    json: async () => body,
    ...overrides,
  }) as unknown as PayloadRequest

describe('submitMissionTask endpoint (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 }, { user: null })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when mission id is missing', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 }, { routeParams: {} })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when the request has no JSON reader', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(makeReq(payload, null, { json: undefined }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
  })

  it('returns 400 for an invalid JSON body', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(
      makeReq(payload, null, {
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when taskId is missing', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(makeReq(payload, { beforePhotoId: 1 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'taskId is required' })
  })

  it('returns 400 when no photo id is provided', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(makeReq(payload, { taskId: 't1' }))
    expect(res.status).toBe(400)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('returns 404 when mission does not exist', async () => {
    const payload = makePayload(null)
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 })
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when the mission belongs to another citizen', async () => {
    const payload = makePayload(makeMission({ citizen: { id: 6 } }))
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 })
    )
    expect(res.status).toBe(403)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 409 when the mission is not in an editable state', async () => {
    const payload = makePayload(makeMission({ status: 'open' }))
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 })
    )
    expect(res.status).toBe(409)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the task is not on the mission', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 'missing', beforePhotoId: 1 })
    )
    expect(res.status).toBe(404)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('attaches the photo to the matching task and marks it completed', async () => {
    jest.useFakeTimers({ now: new Date('2026-03-15T10:30:00.000Z') })
    const payload = makePayload(makeMission())

    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't2', afterPhotoId: 60 })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'missions',
      id: '10',
      data: {
        tasks: [
          { id: 't1', title: 'Collect litter' },
          {
            id: 't2',
            title: 'Paint bench',
            beforePhoto: 50,
            afterPhoto: 60,
            completedByCitizenAt: '2026-03-15T10:30:00.000Z',
          },
        ],
      },
      overrideAccess: true,
    })
  })

  it('sets both photos when both ids are provided', async () => {
    const payload = makePayload(makeMission({ status: 'returned_for_improvement' }))

    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 70, afterPhotoId: 71 })
    )

    expect(res.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tasks: [
            expect.objectContaining({ id: 't1', beforePhoto: 70, afterPhoto: 71 }),
            { id: 't2', title: 'Paint bench', beforePhoto: 50 },
          ],
        },
      })
    )
  })

  it('returns 500 and logs when the update fails', async () => {
    const payload = makePayload(makeMission())
    payload.update.mockRejectedValue(new Error('db down'))

    const res = await submitMissionTask.handler(
      makeReq(payload, { taskId: 't1', beforePhotoId: 1 })
    )

    expect(res.status).toBe(500)
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('mission 10'))
  })
})
