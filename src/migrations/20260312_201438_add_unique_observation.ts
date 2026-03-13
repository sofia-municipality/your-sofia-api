import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Delete duplicate observations keeping only the one with the lowest id per (container_id, cleaned_at) pair.
  await db.execute(sql`
    DELETE FROM waste_container_observations a
      USING waste_container_observations b
    WHERE a.id < b.id
      AND a.container_id = b.container_id
      AND a.cleaned_at = b.cleaned_at;
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX "container_cleanedAt_idx" ON "waste_container_observations" USING btree ("container_id", "cleaned_at");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "container_cleanedAt_idx";
  `)
}
