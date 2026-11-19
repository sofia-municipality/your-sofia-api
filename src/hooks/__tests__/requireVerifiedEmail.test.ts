// payload uses ESM — mock it so Jest can import the hook's APIError
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

import { requireVerifiedEmail } from '../requireVerifiedEmail'

const run = (user: { _verified?: unknown }) =>
  requireVerifiedEmail({ user } as unknown as Parameters<typeof requireVerifiedEmail>[0])

describe('requireVerifiedEmail hook (unit)', () => {
  it('allows login for verified users', () => {
    expect(() => run({ _verified: true })).not.toThrow()
  })

  it.each([
    ['false', false],
    ['missing', undefined],
    ['null', null],
    ['a truthy non-boolean', 'true'],
  ])('blocks login with 403 when _verified is %s', (_label, verified) => {
    let error: unknown
    try {
      run({ _verified: verified })
    } catch (e) {
      error = e
    }

    expect(error).toMatchObject({
      name: 'APIError',
      message: 'Your email address has not been verified. Please check your inbox.',
      status: 403,
    })
  })
})
