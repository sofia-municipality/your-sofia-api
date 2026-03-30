import type { PayloadRequest } from 'payload'

/**
 * Roles that can access collections in the "City Infrastructure" admin group.
 */
export const CITY_INFRASTRUCTURE_ROLES = ['admin', 'inspector', 'containerAdmin'] as const

export type CityInfrastructureRole = (typeof CITY_INFRASTRUCTURE_ROLES)[number]

export const isCityInfrastructureAdmin = (role: string | undefined | null): boolean =>
  CITY_INFRASTRUCTURE_ROLES.includes(role as CityInfrastructureRole)

export const cityInfrastructureAdmin = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isCityInfrastructureAdmin(user?.role)
