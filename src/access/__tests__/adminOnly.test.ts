import { adminOnly } from '../adminOnly'

// adminOnly is an `admin.hidden` helper: it returns true when the collection should be HIDDEN.
describe('adminOnly admin.hidden helper (unit)', () => {
  it('shows the collection to admins', () => {
    expect(adminOnly({ user: { role: 'admin' } })).toBe(false)
  })

  it.each([
    ['an editor', { role: 'editor' }],
    ['a user without a role', {}],
    ['an anonymous visitor', null],
    ['an undefined user', undefined],
  ])('hides the collection from %s', (_label, user) => {
    expect(adminOnly({ user })).toBe(true)
  })
})
