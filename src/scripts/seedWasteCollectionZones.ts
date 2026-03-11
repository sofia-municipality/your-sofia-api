/**
 * Seed script: creates the 10 waste collection zones and 24 city districts.
 * Usage: pnpm tsx --env-file=.env src/scripts/seedWasteCollectionZones.ts
 *
 * Zone → district mapping (from the official zone plan):
 * Zone 1: Средец(23), Лозенец(11), Студентски(22)
 * Zone 2: Искър(7), Панчарево(18)
 * Zone 3: Изгрев(5), Слатина(21), Подуяне(19)
 * Zone 4: Нови Искър(15), Кремиковци(10)
 * Zone 5: Оборище(17), Сердика(20), Възраждане(4)
 * Zone 6: Люлин(12), Овча Купел(16)
 * Zone 7: Илинден(6), Надежда(14), Връбница(3)
 * Zone 8: Триадица(24), Витоша(2)
 * Zone 9: Младост(13), Красна Поляна(8)
 * Zone 10: Банкя(1), Красно Село(9)
 */
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../payload.config'

const ZONES = [
  { number: 1, name: 'Зона 1', districts: ['23', '11', '22'] },
  { number: 2, name: 'Зона 2', districts: ['7', '18'] },
  { number: 3, name: 'Зона 3', districts: ['5', '21', '19'] },
  { number: 4, name: 'Зона 4', districts: ['15', '10'] },
  { number: 5, name: 'Зона 5', districts: ['17', '20', '4'] },
  { number: 6, name: 'Зона 6', districts: ['12', '16'] },
  { number: 7, name: 'Зона 7', districts: ['6', '14', '3'] },
  { number: 8, name: 'Зона 8', districts: ['24', '2'] },
  { number: 9, name: 'Зона 9', districts: ['13', '8'] },
  { number: 10, name: 'Зона 10', districts: ['1', '9'] },
]

/** District numeric id → { name, code, zone number }
 *  code = 'R' + first two letters of name (single-word)
 *       = 'R' + initial letter of each word (multi-word)
 */
const DISTRICTS: { districtId: number; name: string; code: string; zoneNumber: number }[] = [
  { districtId: 1, name: 'Банкя', code: 'RBA', zoneNumber: 10 },
  { districtId: 2, name: 'Витоша', code: 'RVI', zoneNumber: 8 },
  { districtId: 3, name: 'Връбница', code: 'RVR', zoneNumber: 7 },
  { districtId: 4, name: 'Възраждане', code: 'RVA', zoneNumber: 5 },
  { districtId: 5, name: 'Изгрев', code: 'RIZ', zoneNumber: 3 },
  { districtId: 6, name: 'Илинден', code: 'RIL', zoneNumber: 7 },
  { districtId: 7, name: 'Искър', code: 'RIS', zoneNumber: 2 },
  { districtId: 8, name: 'Красна поляна', code: 'RKP', zoneNumber: 9 },
  { districtId: 9, name: 'Красно село', code: 'RKS', zoneNumber: 10 },
  { districtId: 10, name: 'Кремиковци', code: 'RKR', zoneNumber: 4 },
  { districtId: 11, name: 'Лозенец', code: 'RLO', zoneNumber: 1 },
  { districtId: 12, name: 'Люлин', code: 'RLY', zoneNumber: 6 },
  { districtId: 13, name: 'Младост', code: 'RML', zoneNumber: 9 },
  { districtId: 14, name: 'Надежда', code: 'RNA', zoneNumber: 7 },
  { districtId: 15, name: 'Нови Искър', code: 'RNI', zoneNumber: 4 },
  { districtId: 16, name: 'Овча купел', code: 'ROK', zoneNumber: 6 },
  { districtId: 17, name: 'Оборище', code: 'ROB', zoneNumber: 5 },
  { districtId: 18, name: 'Панчарево', code: 'RPA', zoneNumber: 2 },
  { districtId: 19, name: 'Подуяне', code: 'RPO', zoneNumber: 3 },
  { districtId: 20, name: 'Сердика', code: 'RSE', zoneNumber: 5 },
  { districtId: 21, name: 'Слатина', code: 'RSL', zoneNumber: 3 },
  { districtId: 22, name: 'Студентски', code: 'RST', zoneNumber: 1 },
  { districtId: 23, name: 'Средец', code: 'RSR', zoneNumber: 1 },
  { districtId: 24, name: 'Триадица', code: 'RTR', zoneNumber: 8 },
]

async function seed() {
  const payload = await getPayload({ config })

  // ── 1. Seed zones ─────────────────────────────────────────────────────────
  const zoneIdByNumber = new Map<number, number>()

  for (const zone of ZONES) {
    const existing = await payload.find({
      collection: 'waste-collection-zones',
      where: { number: { equals: zone.number } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      console.log(`Zone ${zone.number} already exists, skipping.`)
      zoneIdByNumber.set(zone.number, existing.docs[0]?.id as number)
      continue
    }

    const created = await payload.create({
      collection: 'waste-collection-zones',
      data: zone as any,
      overrideAccess: true,
    })
    zoneIdByNumber.set(zone.number, created.id as number)
    console.log(`Created Zone ${zone.number}: ${zone.name}`)
  }

  // ── 2. Seed city districts ────────────────────────────────────────────────
  // Build a map of district code → payload document ID for phase 3
  const districtPayloadIdByCode = new Map<string, number>()

  for (const district of DISTRICTS) {
    const existing = await payload.find({
      collection: 'city-districts',
      where: { districtId: { equals: district.districtId } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      console.log(`District ${district.districtId} (${district.name}) already exists, skipping.`)
      districtPayloadIdByCode.set(district.code, existing.docs[0]!.id as number)
      continue
    }

    const zonePayloadId = zoneIdByNumber.get(district.zoneNumber)

    const created = await payload.create({
      collection: 'city-districts',
      data: {
        districtId: district.districtId,
        name: district.name,
        code: district.code,
        wasteCollectionZone: zonePayloadId,
      } as any,
      overrideAccess: true,
    })
    districtPayloadIdByCode.set(district.code, created.id as number)
    console.log(
      `Created District ${district.districtId}: ${district.name} [${district.code}] (Zone ${district.zoneNumber})`
    )
  }

  // ── 3. Backfill waste-containers district field ───────────────────────────
  // Single SQL UPDATE joining waste_containers to city_districts on the
  // first 3 characters of public_number matching the district code.
  console.log('Backfilling waste-container district relationships…')

  const result = await payload.db.drizzle.execute(sql`
    UPDATE waste_containers
    SET    district_id = cd.id
    FROM   city_districts cd
    WHERE  LEFT(waste_containers.public_number, 3) = cd.code
      AND  waste_containers.district_id IS DISTINCT FROM cd.id
  `)

  console.log(`Backfill complete: ${result.rowCount ?? 0} containers updated.`)
  console.log('Done seeding waste collection zones and city districts.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
