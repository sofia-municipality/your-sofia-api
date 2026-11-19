import type { Payload } from 'payload'
import {
  findMissionProfileByUser,
  getMissionProfileSummary,
  getOrCreateMissionProfile,
} from '../missionProfiles'

type ProfileDoc = {
  id: number | string
  user: number | string
  darPoints?: unknown
  contributorLevel?: string | null
}
type CreateArgs = {
  collection: string
  data: Omit<ProfileDoc, 'id'>
  overrideAccess: boolean
}

const makePayload = (existing: ProfileDoc[] = []) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: existing })),
  create: jest.fn(async (args: CreateArgs): Promise<ProfileDoc> => ({ id: 100, ...args.data })),
})

type MockPayload = ReturnType<typeof makePayload>

const asPayload = (payload: MockPayload) => payload as unknown as Payload

describe('findMissionProfileByUser', () => {
  it('returns null when the user has no profile', async () => {
    const payload = makePayload()

    await expect(findMissionProfileByUser(asPayload(payload), 7)).resolves.toBeNull()
    expect(payload.find).toHaveBeenCalledWith({
      collection: 'mission-profiles',
      where: { user: { equals: 7 } },
      limit: 1,
      overrideAccess: true,
    })
  })

  it('returns the stored profile', async () => {
    const payload = makePayload([
      { id: 1, user: 7, darPoints: 42, contributorLevel: 'guardian', extra: 'x' } as ProfileDoc,
    ])

    await expect(findMissionProfileByUser(asPayload(payload), 7)).resolves.toEqual({
      id: 1,
      user: 7,
      darPoints: 42,
      contributorLevel: 'guardian',
    })
  })

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '15'])(
    'defaults darPoints %p to 0',
    async (darPoints) => {
      const payload = makePayload([{ id: 1, user: 7, darPoints, contributorLevel: 'contributor' }])

      const profile = await findMissionProfileByUser(asPayload(payload), 7)

      expect(profile?.darPoints).toBe(0)
    }
  )

  it.each([null, undefined, ''])('defaults contributorLevel %p to beginner', async (level) => {
    const payload = makePayload([{ id: 1, user: 7, darPoints: 3, contributorLevel: level }])

    const profile = await findMissionProfileByUser(asPayload(payload), 7)

    expect(profile?.contributorLevel).toBe('beginner')
  })
})

describe('getOrCreateMissionProfile', () => {
  it('returns the existing profile without creating one', async () => {
    const payload = makePayload([{ id: 1, user: 7, darPoints: 5, contributorLevel: 'contributor' }])

    await expect(getOrCreateMissionProfile(asPayload(payload), 7)).resolves.toEqual({
      id: 1,
      user: 7,
      darPoints: 5,
      contributorLevel: 'contributor',
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates a beginner profile with zero points, converting a string user id', async () => {
    const payload = makePayload()

    await expect(getOrCreateMissionProfile(asPayload(payload), '12')).resolves.toEqual({
      id: 100,
      user: 12,
      darPoints: 0,
      contributorLevel: 'beginner',
    })
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'mission-profiles',
      data: { user: 12, darPoints: 0, contributorLevel: 'beginner' },
      overrideAccess: true,
    })
  })

  it('normalizes the created document', async () => {
    const payload = makePayload()
    payload.create.mockResolvedValueOnce({
      id: 'p-1',
      user: 12,
      darPoints: null,
      contributorLevel: null,
    })

    await expect(getOrCreateMissionProfile(asPayload(payload), 12)).resolves.toEqual({
      id: 'p-1',
      user: 12,
      darPoints: 0,
      contributorLevel: 'beginner',
    })
  })

  it('rejects a non-numeric user id before touching the database', async () => {
    const payload = makePayload()

    await expect(getOrCreateMissionProfile(asPayload(payload), 'abc')).rejects.toThrow(
      'Invalid user id for mission profile: abc'
    )
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  // BUG (bugs.md #8): `Number('') === 0`, so a blank id passes validation as user 0.
  it.failing.each(['', '   '])(
    'rejects the blank user id %p before touching the database',
    async (userId) => {
      const payload = makePayload()

      await expect(getOrCreateMissionProfile(asPayload(payload), userId)).rejects.toThrow(
        'Invalid user id for mission profile'
      )
      expect(payload.find).not.toHaveBeenCalled()
      expect(payload.create).not.toHaveBeenCalled()
    }
  )

  it('returns the profile created by a concurrent request when creation fails', async () => {
    const payload = makePayload()
    const concurrent = { id: 9, user: 7, darPoints: 0, contributorLevel: 'beginner' }
    payload.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [concurrent] })
    payload.create.mockRejectedValueOnce(new Error('duplicate key value'))

    await expect(getOrCreateMissionProfile(asPayload(payload), 7)).resolves.toEqual(concurrent)
    expect(payload.find).toHaveBeenCalledTimes(2)
  })

  it('rethrows the creation error when no profile exists afterwards', async () => {
    const payload = makePayload()
    payload.create.mockRejectedValueOnce(new Error('db down'))

    await expect(getOrCreateMissionProfile(asPayload(payload), 7)).rejects.toThrow('db down')
  })
})

describe('getMissionProfileSummary', () => {
  it('returns only the points and contributor level of the existing profile', async () => {
    const payload = makePayload([
      { id: 1, user: 7, darPoints: 30, contributorLevel: 'contributor' },
    ])

    await expect(getMissionProfileSummary(asPayload(payload), 7)).resolves.toEqual({
      darPoints: 30,
      contributorLevel: 'contributor',
    })
  })

  it('creates a profile on first access', async () => {
    const payload = makePayload()

    await expect(getMissionProfileSummary(asPayload(payload), 7)).resolves.toEqual({
      darPoints: 0,
      contributorLevel: 'beginner',
    })
    expect(payload.create).toHaveBeenCalledTimes(1)
  })
})
