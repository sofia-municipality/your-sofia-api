import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import {
  seedDrinkingFountainRows,
  seededFountainPublicNumbers,
} from '../utilities/seedDrinkingFountains'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const count = await seedDrinkingFountainRows(db)
  payload.logger.info(`[seed_drinking_fountains] Seeded ${count} drinking fountains.`)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Only remove the fountains this migration seeded; the source/owner reference
  // rows are left in place as they may be referenced by user-created fountains.
  await db.execute(sql`
    DELETE FROM drinking_fountains
    WHERE public_number = ANY(${seededFountainPublicNumbers})
  `)

  payload.logger.info(
    `[seed_drinking_fountains] Removed up to ${seededFountainPublicNumbers.length} seeded drinking fountains.`,
  )
}
