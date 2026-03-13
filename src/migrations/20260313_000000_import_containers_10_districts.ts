import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_DIR = path.join(__dirname, 'container_import_20260313')

function getCsvFiles(): { code: string; file: string }[] {
  if (!fs.existsSync(CSV_DIR)) return []
  return fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.endsWith('.csv'))
    .map((f) => ({ code: path.basename(f, '.csv'), file: path.join(CSV_DIR, f) }))
}

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

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Starting 10-district container import migration (20260313)...')

  // Build district code → Payload ID lookup
  const allDistricts = await payload.find({
    collection: 'city-districts',
    limit: 30,
    overrideAccess: true,
  })
  const districtIdByCode = new Map<string, number>(
    allDistricts.docs.map((d) => [(d as any).code as string, d.id as number])
  )

  const csvFiles = getCsvFiles()
  console.log(`Found ${csvFiles.length} CSV files in ${CSV_DIR}`)

  let totalImported = 0
  let totalErrors = 0

  for (const { code, file } of csvFiles) {
    const rows = parseCSV(file)
    const districtId = districtIdByCode.get(code) ?? null

    console.log(`\nProcessing ${code}: ${rows.length} rows, districtId=${districtId}`)

    let imported = 0
    let errors = 0

    for (const row of rows) {
      try {
        const capacity = getCapacity(row.type)
        const publicNumber = `${code}-${String(imported + 1).padStart(4, '0')}`

        await payload.create({
          collection: 'waste-containers',
          data: {
            publicNumber,
            location: [row.lng, row.lat],
            district: districtId,
            capacityVolume: capacity.volume,
            capacitySize: capacity.size,
            binCount: row.count || 1,
            wasteType: 'general',
            source: 'official',
            status: 'active',
            state: [],
            notes: `Въведен по данни от инспекторат ${code}`,
          },
        })

        imported++
        if (imported % 100 === 0) {
          console.log(`  ${code}: imported ${imported}...`)
        }
      } catch (error) {
        console.error(`Error importing row:`, row, error)
        errors++
      }
    }

    console.log(`${code} done: imported=${imported} errors=${errors}`)
    totalImported += imported
    totalErrors += errors
  }

  console.log('\n=== Migration Summary ===')
  console.log(`Total Imported: ${totalImported}`)
  console.log(`Total Errors: ${totalErrors}`)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  console.log('Rolling back 10-district container import (20260313)...')

  const codes = getCsvFiles().map(({ code }) => code)
  let totalDeleted = 0

  for (const code of codes) {
    // Delete observations linked to containers imported for this district
    await db.execute(sql`
      DELETE FROM waste_container_observations
      WHERE container_id IN (
        SELECT id FROM waste_containers WHERE public_number LIKE ${code + '-%'}
      )
    `)

    const result = await payload.delete({
      collection: 'waste-containers',
      where: { publicNumber: { like: `${code}-%` } },
      overrideAccess: true,
    })

    const deleted = result.docs.length
    totalDeleted += deleted
    console.log(`Deleted containers with code ${code}: ${deleted}`)
  }

  console.log(`Total deleted: ${totalDeleted}`)
}
