import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

export const validatePassword: CollectionBeforeChangeHook = ({ data, operation }) => {
  if ((operation === 'create' || data?.password) && typeof data?.password === 'string') {
    const p = data.password
    if (p.length < 6) throw new APIError('Password must be at least 6 characters.', 400)
    if (!/[a-z]/.test(p)) throw new APIError('Password must contain a lowercase letter.', 400)
    if (!/[A-Z]/.test(p)) throw new APIError('Password must contain an uppercase letter.', 400)
    if (!/[0-9]/.test(p)) throw new APIError('Password must contain a digit.', 400)
    if (!/[^a-zA-Z0-9]/.test(p))
      throw new APIError('Password must contain a special character.', 400)
  }
  return data
}
