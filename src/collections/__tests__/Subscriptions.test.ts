import { Subscriptions } from '../Subscriptions'

const makeReq = (user?: { role?: string; id?: string } | null) => ({
  req: { user: user ?? null },
})

describe('Subscriptions collection access', () => {
  describe('access.create', () => {
    it('allows unauthenticated devices to create (anonymous subscribe)', () => {
      expect(Subscriptions.access!.create!(makeReq() as any)).toBe(true)
    })

    it('allows authenticated users to create', () => {
      expect(Subscriptions.access!.create!(makeReq({ role: 'user' }) as any)).toBe(true)
    })
  })

  describe('access.read (ownerOrAdmin)', () => {
    it('returns a where-clause filter for regular authenticated users (own subscription only)', () => {
      const result = Subscriptions.access!.read!(makeReq({ role: 'user', id: 'u1' }) as any)
      expect(result).toEqual({ user: { equals: 'u1' } })
    })

    it('allows admin (returns true)', () => {
      expect(Subscriptions.access!.read!(makeReq({ role: 'admin' }) as any)).toBe(true)
    })

    it('denies unauthenticated requests', () => {
      expect(Subscriptions.access!.read!(makeReq(null) as any)).toBe(false)
    })
  })

  describe('access.update (ownerOrAdmin)', () => {
    it('returns a where-clause filter for regular authenticated users (own subscription only)', () => {
      const result = Subscriptions.access!.update!(makeReq({ role: 'user', id: 'u2' }) as any)
      expect(result).toEqual({ user: { equals: 'u2' } })
    })

    it('denies unauthenticated requests', () => {
      expect(Subscriptions.access!.update!(makeReq(null) as any)).toBe(false)
    })
  })

  describe('access.delete', () => {
    it('allows admin to delete', () => {
      expect(Subscriptions.access!.delete!(makeReq({ role: 'admin' }) as any)).toBe(true)
    })

    it('denies regular user', () => {
      expect(Subscriptions.access!.delete!(makeReq({ role: 'user' }) as any)).toBe(false)
    })

    it('denies unauthenticated', () => {
      expect(Subscriptions.access!.delete!(makeReq(null) as any)).toBe(false)
    })
  })

  describe('collection config shape', () => {
    it('has slug "subscriptions"', () => {
      expect(Subscriptions.slug).toBe('subscriptions')
    })

    it('has a locationFilters array field', () => {
      const locationFilters = Subscriptions.fields.find(
        (f: any) => f.name === 'locationFilters' && f.type === 'array'
      )
      expect(locationFilters).toBeDefined()
    })

    it('locationFilters sub-field filterType has all 4 filter options', () => {
      const locationFilters: any = Subscriptions.fields.find(
        (f: any) => f.name === 'locationFilters'
      )
      const filterType: any = locationFilters?.fields.find((f: any) => f.name === 'filterType')
      const values = filterType?.options?.map((o: any) => o.value)
      expect(values).toEqual(expect.arrayContaining(['all', 'district', 'point', 'area']))
    })

    it('filterType defaults to "all"', () => {
      const locationFilters: any = Subscriptions.fields.find(
        (f: any) => f.name === 'locationFilters'
      )
      const filterType: any = locationFilters?.fields.find((f: any) => f.name === 'filterType')
      expect(filterType?.defaultValue).toBe('all')
    })
  })
})
