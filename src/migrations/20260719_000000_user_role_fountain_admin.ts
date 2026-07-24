import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Dedicated role for managing drinking fountains and resolving fountain signals
   ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'fountainAdmin';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Demote fountain admins before narrowing the enum back
   UPDATE "users" SET "role" = 'user' WHERE "role" = 'fountainAdmin';
   ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
   ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
   DROP TYPE "public"."enum_users_role";
   CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin', 'containerAdmin', 'inspector', 'wasteCollector');
   ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
   ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}
