import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_FILE = path.join(__dirname, 'container_import_20260408', 'RPD.csv')

interface CSVRow {
  lat: number
  lng: number
  type: number
  count: number
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const rows: CSVRow[] = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue

    const parts = line.split(',')
    if (parts.length < 4) continue

    const lat = parseFloat(parts[0]!)
    const lng = parseFloat(parts[1]!)
    const type = parseInt(parts[2]!)
    const count = parseInt(parts[3]!)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    rows.push({ lat, lng, type, count })
  }

  return rows
}

function getCapacity(type: number): {
  volume: number
  size: 'tiny' | 'small' | 'standard' | 'big' | 'industrial'
} {
  switch (type) {
    case 110:
      return { volume: 0.11, size: 'tiny' }
    case 120:
      return { volume: 0.12, size: 'small' }
    case 240:
      return { volume: 0.24, size: 'small' }
    case 1100:
      return { volume: 1.1, size: 'standard' }
    case 3000:
      return { volume: 3.0, size: 'big' }
    default:
      return { volume: 1.1, size: 'standard' }
  }
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  console.log('Starting Poduyane (RPD) container import migration (20260408)...')

  // Delete existing containers (and their observations) for ealry imported SOF and SPD prefixes
  for (const prefix of ['SOF', 'SPD']) {
    await db.execute(sql`
      DELETE FROM waste_container_observations
      WHERE container_id IN (
        SELECT id FROM waste_containers WHERE public_number LIKE ${prefix + '-%'}
      )
    `)

    const {docs: toDelete} = await payload.find({
      collection: 'waste-containers',
      where: {publicNumber: {like: `${prefix}-%`}},
      limit: 10000,
      pagination: false,
      overrideAccess: true,
    })
    let deletedCount = 0
    for (let i = 0; i < toDelete.length; i += 10) {
      const batch = toDelete.slice(i, i + 10)
      for (const c of batch) {
        await payload.delete({collection: 'waste-containers', id: c.id, overrideAccess: true})
      }
      deletedCount += batch.length
    }
    console.log(`Deleted ${deletedCount} containers with prefix ${prefix}`)
  }

  const poduyane = await payload.find({
    collection: 'city-districts',
    where: { code: { equals: 'RPD' } }, // fetch all to find the ID by code
    limit: 30,
    overrideAccess: true,
  })
  const poduyaneId = poduyane?.docs[0]?.id ?? null
  
  const rows = parseCSV(CSV_FILE)

  console.log(`Processing RPD: ${rows.length} rows, districtId=${poduyaneId}`)

  let imported = 0
  let errors = 0

  for (const row of rows) {
    try {
      const capacity = getCapacity(row.type)
      const publicNumber = `RPD-${String(imported + 1).padStart(4, '0')}`

      await payload.create({
        collection: 'waste-containers',
        data: {
          publicNumber,
          location: [row.lng, row.lat],
          district: poduyaneId,
          capacityVolume: capacity.volume,
          capacitySize: capacity.size,
          binCount: row.count || 1,
          wasteType: 'general',
          source: 'official',
          status: 'active',
          state: [],
          notes: `Въведен по данни от инспекторат`,
        },
      })

      imported++
      if (imported % 100 === 0) {
        console.log(`  RPD: imported ${imported}...`)
      }
    } catch (error) {
      console.error(`Error importing row:`, row, error)
      errors++
    }
  }

  console.log(`\n=== Migration Summary ===`)
  console.log(`District: RPD (Подуяне)`)
  console.log(`Total Imported: ${imported}`)
  console.log(`Total Errors: ${errors}`)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  console.log('Rolling back Poduyane (SPD) container import (20260408)...')

  await db.execute(sql`
    DELETE FROM waste_container_observations
    WHERE container_id IN (
      SELECT id FROM waste_containers WHERE public_number LIKE 'RPD-%'
    )
  `)

  const result = await payload.delete({
    collection: 'waste-containers',
    where: { publicNumber: { like: 'RPD-%' } },
    overrideAccess: true,
  })

  console.log(`Deleted containers with code RPD: ${result.docs.length}`)
}
