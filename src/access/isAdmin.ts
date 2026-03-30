import type { PayloadRequest } from 'payload'

export const isAdmin = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  user?.role === 'admin'
