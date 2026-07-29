// Run with: pnpm seed:bulky-waste-zones
import { createRequire } from 'node:module'
import { bulkyWasteZones } from '../data/bulkyWasteZones'

const require = createRequire(import.meta.url)
const adapterRequire = createRequire(require.resolve('@payloadcms/db-postgres'))
const { Client } = adapterRequire('pg')

async function seed() {
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) {
    throw new Error('DATABASE_URI is not configured')
  }

  const client = new Client({ connectionString })
  let created = 0
  let updated = 0
  let daysSeeded = 0

  await client.connect()

  try {
    await client.query('BEGIN')

    for (const feature of bulkyWasteZones.features) {
      const result = await client.query(
        `INSERT INTO bulky_waste_zones (source_id, name, info, boundary)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (source_id) DO UPDATE
         SET name = EXCLUDED.name, info = EXCLUDED.info, boundary = EXCLUDED.boundary, updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [
          feature.properties.id,
          feature.properties.name,
          feature.properties.info,
          JSON.stringify(feature.geometry),
        ]
      )

      const zoneId = result.rows[0].id
      const days = feature.properties.collectionDays ?? []

      // Replace the hasMany "Дни за събиране" (collectionDaysOfWeek) values so
      // re-running the seed stays idempotent instead of duplicating rows.
      await client.query(
        'DELETE FROM bulky_waste_zones_collection_days_of_week WHERE parent_id = $1',
        [zoneId]
      )
      for (let i = 0; i < days.length; i++) {
        await client.query(
          `INSERT INTO bulky_waste_zones_collection_days_of_week ("order", parent_id, value)
           VALUES ($1, $2, $3)`,
          [i + 1, zoneId, days[i]]
        )
      }
      daysSeeded += days.length

      if (result.rows[0]?.inserted) {
        created++
      } else {
        updated++
      }
    }

    await client.query('COMMIT')

    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM bulky_waste_zones')
    console.log(
      `Seeded bulky-waste zones: ${created} created, ${updated} updated, ${rows[0]?.count} total; ${daysSeeded} collection-day entries.`
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

seed().catch((error) => {
  console.error('Failed to seed bulky-waste zones:', error)
  process.exit(1)
})
