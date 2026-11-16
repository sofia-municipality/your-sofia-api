import type { Payload } from 'payload'
import {
  computeEligibility,
  CONTRIBUTOR_THRESHOLD,
  getCompletedMissionsCount,
  unlockRequirementLabel,
} from '../eligibility'

describe('mission eligibility (unit)', () => {
  describe('computeEligibility', () => {
    it('always allows good-first-mission', () => {
      expect(
        computeEligibility('good-first-mission', {
          completedMissionsCount: 0,
          guardianApproved: false,
        })
      ).toBe(true)
    })

    it('requires CONTRIBUTOR_THRESHOLD completed missions for verified-contributor', () => {
      const level = 'verified-contributor'
      expect(
        computeEligibility(level, {
          completedMissionsCount: CONTRIBUTOR_THRESHOLD - 1,
          guardianApproved: false,
        })
      ).toBe(false)
      expect(
        computeEligibility(level, {
          completedMissionsCount: CONTRIBUTOR_THRESHOLD,
          guardianApproved: false,
        })
      ).toBe(true)
      expect(
        computeEligibility(level, {
          completedMissionsCount: CONTRIBUTOR_THRESHOLD + 5,
          guardianApproved: false,
        })
      ).toBe(true)
    })

    it('requires guardian approval for verified-guardian regardless of completed count', () => {
      const level = 'verified-guardian'
      expect(
        computeEligibility(level, { completedMissionsCount: 100, guardianApproved: false })
      ).toBe(false)
      expect(computeEligibility(level, { completedMissionsCount: 0, guardianApproved: true })).toBe(
        true
      )
    })

    it('denies unknown levels', () => {
      expect(
        computeEligibility('legendary', { completedMissionsCount: 100, guardianApproved: true })
      ).toBe(false)
    })
  })

  describe('unlockRequirementLabel', () => {
    it('describes the contributor threshold', () => {
      expect(unlockRequirementLabel('verified-contributor')).toBe(
        `Изисква ${CONTRIBUTOR_THRESHOLD} завършени мисии`
      )
    })

    it('describes the guardian requirement', () => {
      expect(unlockRequirementLabel('verified-guardian')).toBe(
        'Изисква статус "Доверен проверяващ"'
      )
    })

    it('returns an empty label for levels without requirements', () => {
      expect(unlockRequirementLabel('good-first-mission')).toBe('')
      expect(unlockRequirementLabel('legendary')).toBe('')
    })
  })

  describe('getCompletedMissionsCount', () => {
    it("counts the user's completed missions", async () => {
      const mockPayload = {
        find: jest.fn(async () => ({ totalDocs: 4, docs: [] })),
      }

      const count = await getCompletedMissionsCount(mockPayload as unknown as Payload, 7)

      expect(count).toBe(4)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'missions',
        where: {
          and: [{ citizen: { equals: 7 } }, { status: { equals: 'completed' } }],
        },
        limit: 0,
        overrideAccess: true,
      })
    })
  })
})
