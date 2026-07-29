import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { bulkyWasteZones } from '../data/bulkyWasteZones'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting bulky-waste zones import migration (20260729_101500)...')

  let created = 0
  let updated = 0
  let daysSeeded = 0

  for (const feature of bulkyWasteZones.features) {
    const data = {
      sourceId: feature.properties.id,
      name: feature.properties.name,
      info: feature.properties.info,
      collectionDaysOfWeek: feature.properties.collectionDays,
      boundary: feature.geometry,
    }

    // Upsert by sourceId so the migration is idempotent and preserves ids
    // if the zones were already seeded (e.g. via pnpm seed:bulky-waste-zones).
    const existing = await payload.find({
      collection: 'bulky-waste-zones',
      where: { sourceId: { equals: feature.properties.id } },
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'bulky-waste-zones',
        id: existing.docs[0].id,
        data: data as any,
        overrideAccess: true,
        req,
      })
      updated++
    } else {
      await payload.create({
        collection: 'bulky-waste-zones',
        data: data as any,
        overrideAccess: true,
        req,
      })
      created++
    }

    daysSeeded += feature.properties.collectionDays.length
  }

  console.log(`\n=== Migration Summary ===`)
  console.log(`Bulky-waste zones: ${created} created, ${updated} updated`)
  console.log(`Collection-day entries: ${daysSeeded}`)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  console.log('Rolling back bulky-waste zones import (20260729_101500)...')

  const sourceIds = bulkyWasteZones.features.map((f) => f.properties.id)

  const result = await payload.delete({
    collection: 'bulky-waste-zones',
    where: { sourceId: { in: sourceIds } },
    overrideAccess: true,
    req,
  })

  console.log(`Deleted ${result.docs.length} bulky-waste zones`)
}
