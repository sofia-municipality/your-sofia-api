import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_signals_fountain_state" AS ENUM('notWorking', 'damaged', 'dirty', 'leaking', 'other');

   CREATE TABLE IF NOT EXISTS "signals_fountain_state" (
     "order" integer NOT NULL,
     "parent_id" integer NOT NULL,
     "value" "enum_signals_fountain_state",
     "id" serial PRIMARY KEY NOT NULL
   );

   ALTER TABLE "signals_fountain_state" ADD CONSTRAINT "signals_fountain_state_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX IF NOT EXISTS "signals_fountain_state_order_idx" ON "signals_fountain_state" USING btree ("order");
   CREATE INDEX IF NOT EXISTS "signals_fountain_state_parent_idx" ON "signals_fountain_state" USING btree ("parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signals_fountain_state" DISABLE ROW LEVEL SECURITY;
   DROP TABLE "signals_fountain_state" CASCADE;
   DROP TYPE "public"."enum_signals_fountain_state";`)
}
