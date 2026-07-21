import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Dedicated category for drinking-fountain signals (mobile now sends it
   -- instead of 'other'). Mirrors the collection config select options.
   ALTER TYPE "public"."enum_signals_category" ADD VALUE IF NOT EXISTS 'drinking-fountain';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Narrow the category enum back to its original values
   UPDATE "signals" SET "category" = 'other' WHERE "category" = 'drinking-fountain';
   ALTER TABLE "signals" ALTER COLUMN "category" DROP DEFAULT;
   ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE text;
   DROP TYPE "public"."enum_signals_category";
   CREATE TYPE "public"."enum_signals_category" AS ENUM('waste-container', 'street-damage', 'lighting', 'green-spaces', 'parking', 'public-transport', 'other');
   ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE "public"."enum_signals_category" USING "category"::"public"."enum_signals_category";
   ALTER TABLE "signals" ALTER COLUMN "category" SET DEFAULT 'other';`)
}
