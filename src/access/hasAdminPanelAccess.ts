import type { PayloadRequest } from 'payload'

/**
 * Returns true for any authenticated staff role (admin, containerAdmin, inspector, wasteCollector).
 * Used as access.admin on the Users collection — the gate Payload checks for admin panel entry.
 * Plain 'user' role accounts cannot access the admin panel.
 */
export const hasAdminPanelAccess = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  Boolean(user) && user?.role !== 'user'
