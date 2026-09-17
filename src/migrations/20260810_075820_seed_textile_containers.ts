import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { seedTextileContainerRows, textileCompanies } from '../utilities/seedTextileContainers'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const count = await seedTextileContainerRows(db)
  payload.logger.info(`[seed_textile_containers] Seeded ${count} textile containers.`)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Remove only the containers belonging to the seeded companies, then the
  // companies themselves. Containers a user added by hand under a different
  // company are left untouched.
  const result = await db.execute(sql`
    DELETE FROM textile_containers
    WHERE company_id IN (
      SELECT id FROM textile_companies WHERE name = ANY(${textileCompanies})
    )
  `)

  await db.execute(sql`
    DELETE FROM textile_companies
    WHERE name = ANY(${textileCompanies})
      AND NOT EXISTS (
        SELECT 1 FROM textile_containers tc WHERE tc.company_id = textile_companies.id
      )
  `)

  payload.logger.info(
    `[seed_textile_containers] Removed ${result.rowCount ?? 0} seeded textile containers.`
  )
}
