jest.mock('../../../utilities/missionProfiles', () => ({
  getMissionProfileSummary: jest.fn(),
}))

import type { PayloadRequest } from 'payload'
import { getMissionProfileSummary } from '../../../utilities/missionProfiles'
import { CONTRIBUTOR_THRESHOLD, unlockRequirementLabel } from '../eligibility'
import { missionsFeed } from '../missionsFeed'

type MissionDoc = {
  id: number
  status: string
  level: string
  citizen: number | { id: number | string } | null
}
type FeedMission = MissionDoc & { locked: boolean; unlockRequirement: string }
type FeedBody = {
  missions: FeedMission[]
  completedMissionsCount: number
  contributorLevel: string
}
type FindResult = { totalDocs?: number; docs: MissionDoc[] }

const mockGetMissionProfileSummary = jest.mocked(getMissionProfileSummary)

// The handler calls payload.find twice: first for the completed-missions count,
// then for the feed itself.
const makePayload = (missions: MissionDoc[], completedMissionsCount = 0) => ({
  find: jest
    .fn<Promise<FindResult>, [unknown]>()
    .mockResolvedValueOnce({ totalDocs: completedMissionsCount, docs: [] })
    .mockResolvedValueOnce({ docs: missions }),
  logger: { error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload, overrides: Record<string, unknown> = {}) =>
  ({ payload, user: { id: 5 }, ...overrides }) as unknown as PayloadRequest

const byId = (missions: FeedMission[]) =>
  Object.fromEntries(missions.map((mission) => [mission.id, mission] as const))

describe('missionsFeed endpoint (unit)', () => {
  beforeEach(() => {
    mockGetMissionProfileSummary.mockResolvedValue({ darPoints: 0, contributorLevel: 'beginner' })
  })

  it('returns 401 when unauthenticated', async () => {
    const payload = makePayload([])
    const res = await missionsFeed.handler(makeReq(payload, { user: null }))
    expect(res.status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("queries open missions plus the user's own missions", async () => {
    const payload = makePayload([])

    await missionsFeed.handler(makeReq(payload))

    expect(payload.find).toHaveBeenLastCalledWith({
      collection: 'missions',
      where: {
        or: [{ status: { equals: 'open' } }, { citizen: { equals: 5 } }],
      },
      depth: 1,
      limit: 100,
      sort: '-createdAt',
      overrideAccess: true,
    })
  })

  it('locks open missions the beginner has not unlocked yet', async () => {
    const payload = makePayload([
      { id: 1, status: 'open', level: 'good-first-mission', citizen: null },
      { id: 2, status: 'open', level: 'verified-contributor', citizen: null },
      { id: 3, status: 'open', level: 'verified-guardian', citizen: null },
    ])

    const res = await missionsFeed.handler(makeReq(payload))

    expect(res.status).toBe(200)
    const body: FeedBody = await res.json()
    expect(body.completedMissionsCount).toBe(0)
    expect(body.contributorLevel).toBe('beginner')

    const missions = byId(body.missions)
    expect(missions[1]).toMatchObject({ locked: false, unlockRequirement: '' })
    expect(missions[2]).toMatchObject({
      locked: true,
      unlockRequirement: unlockRequirementLabel('verified-contributor'),
    })
    expect(missions[3]).toMatchObject({
      locked: true,
      unlockRequirement: unlockRequirementLabel('verified-guardian'),
    })
  })

  it("never locks the user's own missions", async () => {
    const payload = makePayload([
      { id: 1, status: 'open', level: 'verified-contributor', citizen: 5 },
      { id: 2, status: 'open', level: 'verified-guardian', citizen: { id: '5' } },
      { id: 3, status: 'in_progress', level: 'verified-guardian', citizen: { id: 5 } },
    ])

    const res = await missionsFeed.handler(makeReq(payload))

    const body: FeedBody = await res.json()
    const missions = byId(body.missions)
    expect(missions[1]).toMatchObject({ locked: false })
    expect(missions[2]).toMatchObject({ locked: false })
    expect(missions[3]).toMatchObject({
      locked: false,
      // The requirement label is still reported for levels the user has not unlocked.
      unlockRequirement: unlockRequirementLabel('verified-guardian'),
    })
  })

  it('unlocks verified-contributor missions once the threshold is reached', async () => {
    const payload = makePayload(
      [{ id: 1, status: 'open', level: 'verified-contributor', citizen: null }],
      CONTRIBUTOR_THRESHOLD
    )

    const res = await missionsFeed.handler(makeReq(payload))

    const body: FeedBody = await res.json()
    expect(body.completedMissionsCount).toBe(CONTRIBUTOR_THRESHOLD)
    expect(body.missions[0]).toMatchObject({ locked: false, unlockRequirement: '' })
  })

  it('unlocks verified-guardian missions for guardians', async () => {
    mockGetMissionProfileSummary.mockResolvedValue({ darPoints: 99, contributorLevel: 'guardian' })
    const payload = makePayload([
      { id: 1, status: 'open', level: 'verified-guardian', citizen: null },
    ])

    const res = await missionsFeed.handler(makeReq(payload))

    const body: FeedBody = await res.json()
    expect(body.contributorLevel).toBe('guardian')
    expect(body.missions[0]).toMatchObject({ locked: false, unlockRequirement: '' })
  })

  it('returns 500 and logs when loading the feed fails', async () => {
    mockGetMissionProfileSummary.mockRejectedValue(new Error('db down'))
    const payload = makePayload([])

    const res = await missionsFeed.handler(makeReq(payload))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to load missions feed' })
    expect(payload.logger.error).toHaveBeenCalled()
  })
})
