import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin', 'containerAdmin');
  CREATE TYPE "public"."enum_waste_containers_source" AS ENUM('community', 'official', 'third_party');
  ALTER TYPE "public"."enum_signals_container_state" ADD VALUE 'empty';
  ALTER TYPE "public"."enum_signals_container_state" ADD VALUE 'forCollection';
  ALTER TYPE "public"."enum_signals_container_state" ADD VALUE 'broken';
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'user' NOT NULL;
  ALTER TABLE "waste_containers" ADD COLUMN "legacy_id" varchar;
  ALTER TABLE "waste_containers" ADD COLUMN "source" "enum_waste_containers_source" DEFAULT 'community' NOT NULL;
  CREATE UNIQUE INDEX "waste_containers_legacy_id_idx" ON "waste_containers" USING btree ("legacy_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_signals_container_state";
  CREATE TYPE "public"."enum_signals_container_state" AS ENUM('full', 'dirty', 'damaged');
  ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE "public"."enum_signals_container_state" USING "value"::"public"."enum_signals_container_state";
  DROP INDEX "waste_containers_legacy_id_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "waste_containers" DROP COLUMN "legacy_id";
  ALTER TABLE "waste_containers" DROP COLUMN "source";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_waste_containers_source";`)
}
