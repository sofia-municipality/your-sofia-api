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

import { validatePassword } from '../validatePassword'

type UserData = { email?: string; password?: unknown }

const run = (data: UserData | undefined, operation: 'create' | 'update' = 'create') =>
  validatePassword({ data, operation } as unknown as Parameters<typeof validatePassword>[0])

const expectRejected = (password: string, message: string) => {
  let error: unknown
  try {
    run({ password })
  } catch (e) {
    error = e
  }
  expect(error).toMatchObject({ name: 'APIError', message, status: 400 })
}

describe('validatePassword hook (unit)', () => {
  it('accepts a password that satisfies every rule', () => {
    const data = { email: 'a@b.bg', password: 'Abcde1!' }

    expect(run(data)).toBe(data)
  })

  it('rejects passwords shorter than 6 characters', () => {
    expectRejected('Ab1!x', 'Password must be at least 6 characters.')
  })

  it('requires a lowercase letter', () => {
    expectRejected('ABCDE1!', 'Password must contain a lowercase letter.')
  })

  it('requires an uppercase letter', () => {
    expectRejected('abcde1!', 'Password must contain an uppercase letter.')
  })

  it('requires a digit', () => {
    expectRejected('Abcdef!', 'Password must contain a digit.')
  })

  it('requires a special character', () => {
    expectRejected('Abcdef1', 'Password must contain a special character.')
  })

  it('validates a new password on update', () => {
    expect(() => run({ password: 'weak' }, 'update')).toThrow(
      'Password must be at least 6 characters.'
    )
  })

  it('skips validation on update when no password is being set', () => {
    const data = { email: 'a@b.bg' }

    expect(run(data, 'update')).toBe(data)
    expect(run({ email: 'a@b.bg', password: '' }, 'update')).toEqual({
      email: 'a@b.bg',
      password: '',
    })
  })

  it('ignores non-string passwords and missing data', () => {
    expect(run({ password: 123456 })).toEqual({ password: 123456 })
    expect(run(undefined)).toBeUndefined()
  })
})
