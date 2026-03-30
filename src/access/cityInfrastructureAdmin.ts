import type { PayloadRequest } from 'payload'

/**
 * Roles that can administer (write to) collections in the "City Infrastructure" admin group.
 */
export const CITY_INFRASTRUCTURE_ROLES = ['admin', 'inspector', 'containerAdmin'] as const

export type CityInfrastructureRole = (typeof CITY_INFRASTRUCTURE_ROLES)[number]

export const isCityInfrastructureAdmin = (role: string | undefined | null): boolean =>
  CITY_INFRASTRUCTURE_ROLES.includes(role as CityInfrastructureRole)

export const cityInfrastructureAdmin = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isCityInfrastructureAdmin(user?.role)

/**
 * Roles that can VIEW (see in sidebar + read) City Infrastructure collections.
 * wasteCollector is included here but is excluded from write operations.
 */
const CITY_INFRASTRUCTURE_VIEW_ROLES = [
  'admin',
  'inspector',
  'containerAdmin',
  'wasteCollector',
] as const

export const canViewCityInfrastructure = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  (CITY_INFRASTRUCTURE_VIEW_ROLES as readonly string[]).includes(user?.role ?? '')
