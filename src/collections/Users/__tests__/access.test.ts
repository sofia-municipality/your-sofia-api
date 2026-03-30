import { isAdmin } from '@/access/isAdmin'
import { Users } from '../index'

const makeReq = (role?: string) => ({ req: { user: role ? { role } : null } }) as any

describe('Users collection access', () => {
  describe('access.create', () => {
    it('returns true for unauthenticated requests (public registration)', () => {
      expect(Users.access!.create!(makeReq())).toBe(true)
    })
  })

  describe('access.delete', () => {
    it('returns true for admin', () => {
      expect(Users.access!.delete!(makeReq('admin'))).toBe(true)
    })

    it('returns false for regular user', () => {
      expect(Users.access!.delete!(makeReq('user'))).toBe(false)
    })

    it('returns false for inspector', () => {
      expect(Users.access!.delete!(makeReq('inspector'))).toBe(false)
    })
  })

  describe('access.admin (panel entry gate)', () => {
    it('returns true for admin', () => {
      expect(Users.access!.admin!(makeReq('admin'))).toBe(true)
    })

    it('returns true for containerAdmin', () => {
      expect(Users.access!.admin!(makeReq('containerAdmin'))).toBe(true)
    })

    it('returns true for inspector', () => {
      expect(Users.access!.admin!(makeReq('inspector'))).toBe(true)
    })

    it('returns true for wasteCollector', () => {
      expect(Users.access!.admin!(makeReq('wasteCollector'))).toBe(true)
    })

    it('returns false for plain user role', () => {
      expect(Users.access!.admin!(makeReq('user'))).toBe(false)
    })

    it('returns false for unauthenticated', () => {
      expect(Users.access!.admin!(makeReq())).toBe(false)
    })
  })

  describe('isAdmin helper', () => {
    it('returns true only for admin role', () => {
      expect(isAdmin(makeReq('admin'))).toBe(true)
      expect(isAdmin(makeReq('user'))).toBe(false)
      expect(isAdmin(makeReq('inspector'))).toBe(false)
      expect(isAdmin(makeReq())).toBe(false)
    })
  })
})
