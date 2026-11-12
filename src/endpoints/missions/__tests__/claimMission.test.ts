jest.mock('../../../utilities/missionProfiles', () => ({
  getMissionProfileSummary: jest.fn(),
}))

import type { PayloadRequest } from 'payload'
import { getMissionProfileSummary } from '../../../utilities/missionProfiles'
import { claimMission } from '../claimMission'
import { CONTRIBUTOR_THRESHOLD } from '../eligibility'

type MissionDoc = { id: number; status: string; level: string }
type UpdateArgs = { id: string; data: Record<string, unknown> }

const mockGetMissionProfileSummary = jest.mocked(getMissionProfileSummary)

const makePayload = (
  mission: MissionDoc | null,
  { completedMissionsCount = 0 }: { completedMissionsCount?: number } = {}
) => ({
  findByID: jest.fn(async () => mission),
  find: jest.fn(async () => ({ totalDocs: completedMissionsCount, docs: [] })),
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

describe('claimMission endpoint (unit)', () => {
  beforeEach(() => {
    mockGetMissionProfileSummary.mockResolvedValue({ darPoints: 0, contributorLevel: 'beginner' })
  })

  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload(null)
    const res = await claimMission.handler(makeReq(payload, { user: null }))
    expect(res.status).toBe(401)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('returns 400 when mission id is missing', async () => {
    const payload = makePayload(null)
    const res = await claimMission.handler(makeReq(payload, { routeParams: {} }))
    expect(res.status).toBe(400)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('returns 404 when mission does not exist', async () => {
    const payload = makePayload(null)
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(404)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'missions', id: '10', overrideAccess: true })
    )
  })

  it('returns 409 when mission is not open', async () => {
    const payload = makePayload({ id: 10, status: 'in_progress', level: 'good-first-mission' })
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(409)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 403 when user has not completed enough missions for verified-contributor', async () => {
    const payload = makePayload(
      { id: 10, status: 'open', level: 'verified-contributor' },
      { completedMissionsCount: CONTRIBUTOR_THRESHOLD - 1 }
    )
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(403)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 403 for verified-guardian missions when user is not a guardian', async () => {
    mockGetMissionProfileSummary.mockResolvedValue({
      darPoints: 50,
      contributorLevel: 'contributor',
    })
    const payload = makePayload(
      { id: 10, status: 'open', level: 'verified-guardian' },
      { completedMissionsCount: 20 }
    )
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(403)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('assigns an open good-first-mission to the user', async () => {
    const payload = makePayload({ id: 10, status: 'open', level: 'good-first-mission' })

    const res = await claimMission.handler(makeReq(payload))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      mission: { citizen: 5, status: 'in_progress' },
    })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'missions',
      id: '10',
      data: { citizen: 5, status: 'in_progress' },
      overrideAccess: true,
    })
  })

  it('allows verified-contributor missions once the threshold is reached', async () => {
    const payload = makePayload(
      { id: 10, status: 'open', level: 'verified-contributor' },
      { completedMissionsCount: CONTRIBUTOR_THRESHOLD }
    )
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(200)
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'missions' }))
  })

  it('allows verified-guardian missions for guardians', async () => {
    mockGetMissionProfileSummary.mockResolvedValue({ darPoints: 50, contributorLevel: 'guardian' })
    const payload = makePayload({ id: 10, status: 'open', level: 'verified-guardian' })
    const res = await claimMission.handler(makeReq(payload))
    expect(res.status).toBe(200)
    expect(mockGetMissionProfileSummary).toHaveBeenCalledWith(payload, 5)
  })

  it('returns 500 and logs when the lookup fails', async () => {
    const payload = makePayload(null)
    payload.findByID.mockRejectedValue(new Error('db down'))

    const res = await claimMission.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to claim mission' })
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('mission 10'))
  })
})
