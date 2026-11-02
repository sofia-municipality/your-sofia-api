jest.mock('../../../utilities/missionProfiles', () => ({
  getMissionProfileSummary: jest.fn(),
}))

import type { PayloadRequest } from 'payload'
import { getMissionProfileSummary } from '../../../utilities/missionProfiles'
import { missionProfileMe } from '../missionProfileMe'

const mockGetMissionProfileSummary = jest.mocked(getMissionProfileSummary)

const makePayload = () => ({ logger: { error: jest.fn() } })

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, overrides: Record<string, unknown> = {}) =>
  ({ payload, user: { id: 5 }, ...overrides }) as unknown as PayloadRequest

describe('missionProfileMe endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await missionProfileMe.handler(makeReq(makePayload(), { user: null }))
    expect(res.status).toBe(401)
    expect(await res.json()).toHaveProperty('error')
    expect(mockGetMissionProfileSummary).not.toHaveBeenCalled()
  })

  it("returns the current user's mission profile summary", async () => {
    const profile = { darPoints: 12, contributorLevel: 'contributor' as const }
    mockGetMissionProfileSummary.mockResolvedValue(profile)
    const payload = makePayload()

    const res = await missionProfileMe.handler(makeReq(payload))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(profile)
    expect(mockGetMissionProfileSummary).toHaveBeenCalledWith(payload, 5)
  })

  it('returns 500 and logs when loading the profile fails', async () => {
    mockGetMissionProfileSummary.mockRejectedValue(new Error('db down'))
    const payload = makePayload()

    const res = await missionProfileMe.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to load mission profile' })
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('user 5'))
  })
})
