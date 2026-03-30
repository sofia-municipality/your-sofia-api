/**
 * admin.hidden helper — hides a collection from the admin sidebar for all non-admin users.
 * Usage: admin: { hidden: adminOnly }
 */
export const adminOnly = ({ user }: { user: unknown }): boolean =>
  (user as { role?: string } | null)?.role !== 'admin'
