import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- serviced_by now stores the GPS FirmId. Legacy text values ("95", "Фирма: 95") keep their
  -- number; values without digits (e.g. "Столична община") become NULL.
  ALTER TABLE "waste_containers" ALTER COLUMN "serviced_by" SET DATA TYPE numeric
    USING NULLIF(substring("serviced_by" from '[0-9]+'), '')::numeric;
  ALTER TABLE "waste_containers" ADD COLUMN "last_cleaned_by" numeric;

  -- Backfill from each container's most recent GPS observation
  UPDATE "waste_containers" wc
  SET "last_cleaned_by" = latest."vehicle_id"
  FROM (
    SELECT DISTINCT ON ("container_id") "container_id", "vehicle_id"
    FROM "waste_container_observations"
    WHERE "vehicle_id" IS NOT NULL
    ORDER BY "container_id", "cleaned_at" DESC
  ) latest
  WHERE wc."id" = latest."container_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "waste_containers" ALTER COLUMN "serviced_by" SET DATA TYPE varchar
    USING "serviced_by"::varchar;
  ALTER TABLE "waste_containers" DROP COLUMN "last_cleaned_by";`)
}
