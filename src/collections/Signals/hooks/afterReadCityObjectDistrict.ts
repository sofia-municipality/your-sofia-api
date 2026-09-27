import type { FieldHook, PayloadRequest } from 'payload'
import type { CityDistrict } from '@/payload-types'

const DISTRICT_SOURCES = {
  'waste-container': { slug: 'waste-containers', lookupField: 'publicNumber' },
  'drinking-fountain': { slug: 'drinking-fountains', lookupField: 'publicNumber' },
} as const satisfies Record<string, { slug: string; lookupField: string }>

type DistrictSummary = Pick<CityDistrict, 'id' | 'districtId' | 'name' | 'code'>

const CACHE_KEY = '_signalCityObjectDistricts'

// One request can read hundreds of signals; cache resolved objects per request so
// repeated references to the same container hit the DB only once.
const getCache = (req: PayloadRequest): Map<string, DistrictSummary | null> => {
  const existing = req.context[CACHE_KEY] as Map<string, DistrictSummary | null> | undefined
  if (existing) return existing

  const cache = new Map<string, DistrictSummary | null>()
  req.context[CACHE_KEY] = cache
  return cache
}

const toSummary = (district: unknown): DistrictSummary | null => {
  if (!district || typeof district !== 'object') return null
  const doc = district as CityDistrict
  return {
    id: doc.id,
    districtId: doc.districtId,
    name: doc.name,
    code: doc.code,
  }
}

/**
 * Resolves the district of the city object a signal points at (`cityObject.referenceId`)
 * and returns it as a nested object. Virtual — nothing is stored on the signal itself.
 */
export const afterReadCityObjectDistrict: FieldHook = async ({ siblingData, req }) => {
  const cityObject = siblingData as
    { referenceId?: null | string; type?: null | string } | undefined

  const type = cityObject?.type
  const referenceId = cityObject?.referenceId
  if (!type || !referenceId) return undefined

  const source = DISTRICT_SOURCES[type as keyof typeof DISTRICT_SOURCES]
  if (!source) return undefined

  const cache = getCache(req)
  const cacheKey = `${source.slug}:${referenceId}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? undefined

  try {
    const { docs } = await req.payload.find({
      collection: source.slug,
      depth: 1,
      limit: 1,
      overrideAccess: true,
      req,
      select: { district: true },
      where: { [source.lookupField]: { equals: referenceId } },
    })

    const summary = toSummary(docs[0]?.district)
    cache.set(cacheKey, summary)
    return summary ?? undefined
  } catch (error) {
    // Never fail a read because the linked object could not be resolved
    req.payload.logger.error(
      `Failed to resolve district for ${source.slug} ${referenceId}: ${error}`
    )
    return undefined
  }
}
