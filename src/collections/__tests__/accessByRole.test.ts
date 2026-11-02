// @payloadcms/db-postgres uses ESM — mock the sql tag used by the map-data endpoints
jest.mock('@payloadcms/db-postgres', () => ({
  sql: jest.fn(),
}))

import type { AccessArgs, CollectionConfig } from 'payload'
import { BulkyWasteZones } from '../BulkyWasteZones'
import { Categories } from '../Categories'
import { CityDistricts } from '../CityDistricts'
import { DrinkingFountains } from '../DrinkingFountains'
import { DrinkingFountainSource } from '../DrinkingFountainSource'
import { FeatureConfig } from '../FeatureConfig'
import { FountainOwner } from '../FountainOwner'
import { GeocodeAddresses } from '../GeocodeAddresses'
import { afterChangeSetFountainPublicNumber } from '../hooks/afterChangeSetFountainPublicNumber'
import { TextileCompanies } from '../TextileCompanies'
import { TextileContainers } from '../TextileContainers'
import { WasteCollectionZones } from '../WasteCollectionZones'

// Collections whose access rules only combine the shared helpers in src/access.
// Each rule is checked against every role, so a changed helper or a swapped rule shows up here.

type Viewer =
  | 'anonymous'
  | 'user'
  | 'wasteCollector'
  | 'containerAdmin'
  | 'fountainAdmin'
  | 'inspector'
  | 'admin'
type Rule = 'admin' | 'read' | 'create' | 'update' | 'delete'
// `null` means the collection does not set the rule, so Payload's default applies
type Expectations = Record<Rule, readonly Viewer[] | null>

const VIEWERS: readonly Viewer[] = [
  'anonymous',
  'user',
  'wasteCollector',
  'containerAdmin',
  'fountainAdmin',
  'inspector',
  'admin',
]
const RULES: readonly Rule[] = ['admin', 'read', 'create', 'update', 'delete']

const EVERYONE = VIEWERS
const SIGNED_IN = VIEWERS.filter((viewer) => viewer !== 'anonymous')
const ADMINS: readonly Viewer[] = ['admin']
const CITY_INFRASTRUCTURE_ADMINS: readonly Viewer[] = [
  'admin',
  'inspector',
  'containerAdmin',
  'fountainAdmin',
]
const CITY_INFRASTRUCTURE_VIEWERS: readonly Viewer[] = [
  'admin',
  'inspector',
  'containerAdmin',
  'wasteCollector',
]
const FOUNTAIN_ADMINS: readonly Viewer[] = ['admin', 'inspector', 'fountainAdmin']

const publicCityData: Expectations = {
  admin: CITY_INFRASTRUCTURE_VIEWERS,
  read: EVERYONE,
  create: CITY_INFRASTRUCTURE_ADMINS,
  update: CITY_INFRASTRUCTURE_ADMINS,
  delete: CITY_INFRASTRUCTURE_ADMINS,
}

const publicFountainData: Expectations = {
  admin: FOUNTAIN_ADMINS,
  read: EVERYONE,
  create: FOUNTAIN_ADMINS,
  update: FOUNTAIN_ADMINS,
  delete: FOUNTAIN_ADMINS,
}

const cases: Array<{ collection: CollectionConfig; rules: Expectations }> = [
  {
    collection: BulkyWasteZones,
    rules: { admin: null, read: EVERYONE, create: null, update: null, delete: null },
  },
  {
    collection: Categories,
    rules: {
      admin: ADMINS,
      read: EVERYONE,
      create: SIGNED_IN,
      update: SIGNED_IN,
      delete: SIGNED_IN,
    },
  },
  {
    collection: CityDistricts,
    rules: {
      admin: CITY_INFRASTRUCTURE_VIEWERS,
      read: EVERYONE,
      create: ADMINS,
      update: ADMINS,
      delete: ADMINS,
    },
  },
  {
    collection: FeatureConfig,
    rules: { admin: null, read: ADMINS, create: ADMINS, update: ADMINS, delete: ADMINS },
  },
  {
    collection: GeocodeAddresses,
    rules: {
      admin: CITY_INFRASTRUCTURE_ADMINS,
      read: CITY_INFRASTRUCTURE_ADMINS,
      create: ADMINS,
      update: ADMINS,
      delete: ADMINS,
    },
  },
  { collection: DrinkingFountains, rules: publicFountainData },
  { collection: DrinkingFountainSource, rules: publicFountainData },
  { collection: FountainOwner, rules: publicFountainData },
  { collection: TextileCompanies, rules: publicCityData },
  { collection: TextileContainers, rules: publicCityData },
  { collection: WasteCollectionZones, rules: publicCityData },
]

const userFor = (viewer: Viewer) => (viewer === 'anonymous' ? null : { id: 1, role: viewer })

const evaluate = async (collection: CollectionConfig, rule: Rule, viewer: Viewer) => {
  const args = { req: { user: userFor(viewer) } }
  if (rule === 'admin') {
    const check = collection.access?.admin
    if (!check) throw new Error(`${collection.slug} has no admin access rule`)
    return check(args as unknown as Parameters<typeof check>[0])
  }
  const check = collection.access?.[rule]
  if (!check) throw new Error(`${collection.slug} has no ${rule} access rule`)
  return check(args as unknown as AccessArgs)
}

const describeViewers = (viewers: readonly Viewer[]) =>
  viewers.length === VIEWERS.length ? 'everyone' : viewers.join(', ')

describe('collection access by role', () => {
  for (const { collection, rules } of cases) {
    describe(collection.slug, () => {
      for (const rule of RULES) {
        const allowed = rules[rule]

        if (allowed === null) {
          it(`leaves ${rule} access to the Payload default`, () => {
            expect(collection.access?.[rule]).toBeUndefined()
          })
          continue
        }

        it(`grants ${rule} access to ${describeViewers(allowed)}`, async () => {
          for (const viewer of VIEWERS) {
            // Include the viewer so a failure names the role that got the wrong answer
            expect({ viewer, granted: await evaluate(collection, rule, viewer) }).toEqual({
              viewer,
              granted: allowed.includes(viewer),
            })
          }
        })
      }
    })
  }
})

describe('DrinkingFountains hooks', () => {
  it('assigns a public number after a fountain is created', () => {
    expect(DrinkingFountains.hooks?.afterChange).toEqual([afterChangeSetFountainPublicNumber])
  })
})
