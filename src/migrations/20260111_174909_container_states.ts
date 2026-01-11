import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_signals_container_state";
  CREATE TYPE "public"."enum_signals_container_state" AS ENUM('full', 'dirty', 'damaged', 'empty', 'maintenance', 'forCollection', 'fallen', 'bulkyWaste');
  ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE "public"."enum_signals_container_state" USING "value"::"public"."enum_signals_container_state";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_signals_container_state";
  CREATE TYPE "public"."enum_signals_container_state" AS ENUM('full', 'dirty', 'damaged', 'empty', 'forCollection', 'broken');
  ALTER TABLE "signals_container_state" ALTER COLUMN "value" SET DATA TYPE "public"."enum_signals_container_state" USING "value"::"public"."enum_signals_container_state";`)
}
