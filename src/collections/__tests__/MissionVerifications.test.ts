// payload uses ESM — mock it so Jest can import the hooks' APIError
jest.mock('payload', () => ({
  APIError: class APIError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  },
}))

jest.mock('../../utilities/missionProfiles', () => ({
  findMissionProfileByUser: jest.fn(),
}))

import type { AccessArgs } from 'payload'
import { CITY_INFRASTRUCTURE_ROLES } from '@/access/cityInfrastructureAdmin'
import { findMissionProfileByUser } from '../../utilities/missionProfiles'
import { MissionVerifications } from '../MissionVerifications'

const mockFindMissionProfileByUser = jest.mocked(findMissionProfileByUser)

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number | string; role: string } | null
type VerificationData = {
  mission?: number | { id: number }
  decision?: string
  verifier?: number | string
}
type MissionDoc = { id: number; status: string; citizen?: number | { id: number | string } | null }
type Verification = { decision: 'approve' | 'reject'; verifier: number | { id: number } }
type VerificationDoc = { id: number; mission?: number | { id: number } | null }

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = MissionVerifications.access?.[operation]
  if (!rule) throw new Error(`MissionVerifications has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const readyMission: MissionDoc = { id: 10, status: 'ready_for_review', citizen: 6 }

const makeValidationPayload = ({
  mission = readyMission,
  existing = [],
}: { mission?: MissionDoc | null; existing?: Array<{ id: number }> } = {}) => ({
  findByID: jest.fn(async (_args: unknown) => mission),
  find: jest.fn(async (_args: unknown) => ({ docs: existing })),
})

type ValidationPayload = ReturnType<typeof makeValidationPayload>

const runBeforeValidate = (
  payload: ValidationPayload,
  data: VerificationData,
  {
    user = { id: 5, role: 'user' },
    operation = 'create',
  }: { user?: MockUser; operation?: 'create' | 'update' } = {}
): Promise<VerificationData> => {
  const hook = MissionVerifications.hooks?.beforeValidate?.[0]
  if (!hook) throw new Error('MissionVerifications has no beforeValidate hook')
  return hook({ data, operation, req: { user, payload } } as unknown as Parameters<typeof hook>[0])
}

const makeConsensusPayload = (verifications: Verification[]) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: verifications })),
  update: jest.fn(async (_args: unknown) => ({})),
  logger: { error: jest.fn() },
})

type ConsensusPayload = ReturnType<typeof makeConsensusPayload>

const runAfterChange = (
  payload: ConsensusPayload,
  doc: VerificationDoc,
  operation: 'create' | 'update' = 'create'
): Promise<VerificationDoc> => {
  const hook = MissionVerifications.hooks?.afterChange?.[0]
  if (!hook) throw new Error('MissionVerifications has no afterChange hook')
  return hook({ doc, operation, req: { payload } } as unknown as Parameters<typeof hook>[0])
}

const makeGuardians = (...guardianIds: number[]) =>
  mockFindMissionProfileByUser.mockImplementation(async (_payload, userId) =>
    guardianIds.includes(Number(userId))
      ? { id: `p${userId}`, user: userId, darPoints: 0, contributorLevel: 'guardian' }
      : null
  )

const consensusFor = async (verifications: Verification[]) => {
  const payload = makeConsensusPayload(verifications)
  await runAfterChange(payload, { id: 1, mission: 10 })
  return payload.update
}

const consensusUpdate = (communityConsensus: string) => ({
  collection: 'missions',
  id: 10,
  data: { communityConsensus },
  overrideAccess: true,
})

describe('MissionVerifications collection access', () => {
  it('lets any authenticated user submit a verification', async () => {
    for (const role of ['user', 'wasteCollector', 'admin']) {
      expect(await checkAccess('create', { id: 5, role })).toBe(true)
    }
    expect(await checkAccess('create', null)).toBe(false)
  })

  it('lets admins read every verification', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('read', { id: 1, role })).toBe(true)
    }
  })

  it('limits citizens to their own verifications and verifications of their missions', async () => {
    expect(await checkAccess('read', { id: 5, role: 'user' })).toEqual({
      or: [{ verifier: { equals: 5 } }, { 'mission.citizen': { equals: 5 } }],
    })
    expect(await checkAccess('read', null)).toBe(false)
  })

  it('never allows editing a verification', async () => {
    for (const role of ['admin', 'inspector', 'user']) {
      expect(await checkAccess('update', { id: 1, role })).toBe(false)
    }
  })

  it('lets only city infrastructure admins delete verifications', async () => {
    for (const role of CITY_INFRASTRUCTURE_ROLES) {
      expect(await checkAccess('delete', { id: 1, role })).toBe(true)
    }
    expect(await checkAccess('delete', { id: 5, role: 'user' })).toBe(false)
    expect(await checkAccess('delete', null)).toBe(false)
  })
})

describe('MissionVerifications beforeValidate hook', () => {
  it('ignores updates', async () => {
    const payload = makeValidationPayload()
    const data = { decision: 'reject' }

    await expect(runBeforeValidate(payload, data, { operation: 'update' })).resolves.toBe(data)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('requires an authenticated verifier', async () => {
    await expect(
      runBeforeValidate(makeValidationPayload(), { mission: 10 }, { user: null })
    ).rejects.toMatchObject({ status: 401 })
  })

  it('requires a mission', async () => {
    await expect(runBeforeValidate(makeValidationPayload(), {})).rejects.toMatchObject({
      status: 400,
      message: 'Не е посочена мисия за проверка.',
    })
  })

  it('rejects unknown missions', async () => {
    await expect(
      runBeforeValidate(makeValidationPayload({ mission: null }), { mission: 10 })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects missions that are not waiting for review', async () => {
    const payload = makeValidationPayload({ mission: { ...readyMission, status: 'in_progress' } })
    await expect(runBeforeValidate(payload, { mission: 10 })).rejects.toMatchObject({ status: 400 })
  })

  it("rejects verifying one's own mission", async () => {
    for (const citizen of [5, { id: '5' }]) {
      const payload = makeValidationPayload({ mission: { ...readyMission, citizen } })
      await expect(runBeforeValidate(payload, { mission: 10 })).rejects.toMatchObject({
        status: 403,
      })
    }
  })

  it('rejects a second verification from the same verifier', async () => {
    const payload = makeValidationPayload({ existing: [{ id: 1 }] })

    await expect(runBeforeValidate(payload, { mission: 10 })).rejects.toMatchObject({ status: 409 })
    expect(payload.find).toHaveBeenCalledWith({
      collection: 'mission-verifications',
      where: { and: [{ mission: { equals: 10 } }, { verifier: { equals: 5 } }] },
      limit: 1,
      overrideAccess: true,
    })
  })

  it('records the authenticated user as the verifier', async () => {
    const payload = makeValidationPayload()

    await expect(
      runBeforeValidate(payload, { mission: { id: 10 }, decision: 'approve', verifier: 99 })
    ).resolves.toEqual({ mission: { id: 10 }, decision: 'approve', verifier: 5 })
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: 'missions',
      id: 10,
      overrideAccess: true,
    })
  })
})

describe('MissionVerifications afterChange hook — community consensus', () => {
  beforeEach(() => {
    mockFindMissionProfileByUser.mockResolvedValue(null)
  })

  it('ignores updates and verifications without a mission', async () => {
    const payload = makeConsensusPayload([])
    const doc = { id: 1, mission: 10 }

    await expect(runAfterChange(payload, doc, 'update')).resolves.toBe(doc)
    await runAfterChange(payload, { id: 2, mission: null })

    expect(payload.find).not.toHaveBeenCalled()
  })

  it('marks the mission trusted when a guardian approves it', async () => {
    makeGuardians(7)
    const payload = makeConsensusPayload([
      { decision: 'approve', verifier: { id: 7 } },
      { decision: 'reject', verifier: 8 },
    ])

    await runAfterChange(payload, { id: 1, mission: { id: 10 } })

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'mission-verifications',
      where: { mission: { equals: 10 } },
      depth: 1,
      limit: 100,
      overrideAccess: true,
    })
    expect(payload.update).toHaveBeenCalledWith(consensusUpdate('trusted_verified'))
  })

  it('marks the mission peer verified after three distinct approvals', async () => {
    const update = await consensusFor([
      { decision: 'approve', verifier: 1 },
      { decision: 'approve', verifier: 2 },
      { decision: 'approve', verifier: { id: 3 } },
      { decision: 'reject', verifier: 4 },
    ])
    expect(update).toHaveBeenCalledWith(consensusUpdate('peer_verified'))
  })

  it('counts repeated approvals from the same verifier once', async () => {
    const update = await consensusFor([
      { decision: 'approve', verifier: 1 },
      { decision: 'approve', verifier: { id: 1 } },
      { decision: 'approve', verifier: 2 },
    ])
    expect(update).toHaveBeenCalledWith(consensusUpdate('none'))
  })

  it('marks the mission disputed when it is rejected without enough approvals', async () => {
    const update = await consensusFor([
      { decision: 'approve', verifier: 1 },
      { decision: 'reject', verifier: 2 },
    ])
    expect(update).toHaveBeenCalledWith(consensusUpdate('disputed'))
  })

  it('only checks approving verifiers for guardian status', async () => {
    makeGuardians(2)

    const update = await consensusFor([
      { decision: 'approve', verifier: 1 },
      { decision: 'reject', verifier: 2 },
    ])

    expect(update).toHaveBeenCalledWith(consensusUpdate('disputed'))
    expect(mockFindMissionProfileByUser).toHaveBeenCalledTimes(1)
    expect(mockFindMissionProfileByUser).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('stops looking up profiles after the first guardian', async () => {
    makeGuardians(1, 2)

    await consensusFor([
      { decision: 'approve', verifier: 1 },
      { decision: 'approve', verifier: 2 },
    ])

    expect(mockFindMissionProfileByUser).toHaveBeenCalledTimes(1)
  })

  it('reports no consensus for a single peer approval', async () => {
    const update = await consensusFor([{ decision: 'approve', verifier: 1 }])
    expect(update).toHaveBeenCalledWith(consensusUpdate('none'))
  })

  it('logs failures without failing the verification', async () => {
    const payload = makeConsensusPayload([])
    payload.find.mockRejectedValueOnce(new Error('db down'))
    const doc = { id: 1, mission: 10 }

    await expect(runAfterChange(payload, doc)).resolves.toBe(doc)
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
