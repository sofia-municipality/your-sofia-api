import type { CollectionBeforeLoginHook } from 'payload'
import { APIError } from 'payload'

export const requireVerifiedEmail: CollectionBeforeLoginHook = ({ user }) => {
  if (user._verified !== true) {
    throw new APIError('Your email address has not been verified. Please check your inbox.', 403)
  }
}
