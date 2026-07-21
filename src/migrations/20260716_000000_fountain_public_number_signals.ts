import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- ── Public identifier for fountains (e.g. DF-RTR-0001) ─────────────────────
   ALTER TABLE "drinking_fountains" ADD COLUMN IF NOT EXISTS "public_number" varchar;

   -- Backfill existing rows: DF-<district code>-<zero-padded id>
   UPDATE "drinking_fountains" df
   SET "public_number" = 'DF-' || COALESCE(cd."code", 'XXX') || '-' || LPAD(df."id"::text, 4, '0')
   FROM "city_districts" cd
   WHERE cd."id" = df."district_id";

   -- Fountains with no assigned district fall back to a neutral code
   UPDATE "drinking_fountains"
   SET "public_number" = 'DF-XXX-' || LPAD("id"::text, 4, '0')
   WHERE "public_number" IS NULL;

   CREATE UNIQUE INDEX IF NOT EXISTS "drinking_fountains_public_number_idx"
     ON "drinking_fountains" USING btree ("public_number");

   -- ── Allow signals to reference drinking fountains ─────────────────────────
   ALTER TYPE "public"."enum_signals_city_object_type" ADD VALUE IF NOT EXISTS 'drinking-fountain';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "drinking_fountains_public_number_idx";
   ALTER TABLE "drinking_fountains" DROP COLUMN IF EXISTS "public_number";

   -- Narrow the signals object-type enum back to its original values
   UPDATE "signals" SET "city_object_type" = NULL WHERE "city_object_type" = 'drinking-fountain';
   ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE text;
   DROP TYPE "public"."enum_signals_city_object_type";
   CREATE TYPE "public"."enum_signals_city_object_type" AS ENUM('waste-container', 'street', 'park', 'building', 'other');
   ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE "public"."enum_signals_city_object_type" USING "city_object_type"::"public"."enum_signals_city_object_type";`)
}
