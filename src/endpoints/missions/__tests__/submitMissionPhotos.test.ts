import type { PayloadRequest } from 'payload'
import { submitMissionPhotos } from '../submitMissionPhotos'

type PhotoRef = number | { id: number; url?: string }
type MissionDoc = {
  id: number
  citizen: number | { id: number | string } | null
  status: string
  missionBeforePhotos?: PhotoRef[]
  missionAfterPhotos?: PhotoRef[]
}
type UpdateArgs = { id: string; data: Record<string, unknown> }

const makeMission = (overrides: Partial<MissionDoc> = {}): MissionDoc => ({
  id: 10,
  citizen: 5,
  status: 'in_progress',
  missionBeforePhotos: [],
  missionAfterPhotos: [],
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

describe('submitMissionPhotos endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionPhotos.handler(
      makeReq(payload, { beforePhotoIds: [1] }, { user: null })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when mission id is missing', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionPhotos.handler(
      makeReq(payload, { beforePhotoIds: [1] }, { routeParams: {} })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when the request has no JSON reader', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionPhotos.handler(makeReq(payload, null, { json: undefined }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
  })

  it('returns 400 for an invalid JSON body', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionPhotos.handler(
      makeReq(payload, null, {
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when no photo ids are provided', async () => {
    const payload = makePayload(makeMission())
    const res = await submitMissionPhotos.handler(
      makeReq(payload, { beforePhotoIds: [], afterPhotoIds: 'not-an-array' })
    )
    expect(res.status).toBe(400)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('returns 404 when mission does not exist', async () => {
    const payload = makePayload(null)
    const res = await submitMissionPhotos.handler(makeReq(payload, { beforePhotoIds: [1] }))
    expect(res.status).toBe(404)
  })

  it('returns 403 when the mission belongs to another citizen', async () => {
    const payload = makePayload(makeMission({ citizen: 6 }))
    const res = await submitMissionPhotos.handler(makeReq(payload, { beforePhotoIds: [1] }))
    expect(res.status).toBe(403)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 409 when the mission is not in an editable state', async () => {
    const payload = makePayload(makeMission({ status: 'completed' }))
    const res = await submitMissionPhotos.handler(makeReq(payload, { beforePhotoIds: [1] }))
    expect(res.status).toBe(409)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('appends new photo ids to the existing mission photos', async () => {
    const payload = makePayload(
      makeMission({
        missionBeforePhotos: [{ id: 1, url: '/media/1.jpg' }, 2],
        missionAfterPhotos: undefined,
      })
    )

    const res = await submitMissionPhotos.handler(
      makeReq(payload, { beforePhotoIds: [3], afterPhotoIds: [4, 5] })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'missions',
      id: '10',
      data: {
        missionBeforePhotos: [1, 2, 3],
        missionAfterPhotos: [4, 5],
      },
      overrideAccess: true,
    })
  })

  it('keeps existing before photos when only after photos are submitted', async () => {
    const payload = makePayload(
      makeMission({ status: 'returned_for_improvement', missionBeforePhotos: [{ id: 1 }] })
    )

    const res = await submitMissionPhotos.handler(makeReq(payload, { afterPhotoIds: [9] }))

    expect(res.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { missionBeforePhotos: [1], missionAfterPhotos: [9] },
      })
    )
  })

  it('returns 500 and logs when the update fails', async () => {
    const payload = makePayload(makeMission())
    payload.update.mockRejectedValue(new Error('db down'))

    const res = await submitMissionPhotos.handler(makeReq(payload, { beforePhotoIds: [1] }))

    expect(res.status).toBe(500)
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('mission 10'))
  })
})
