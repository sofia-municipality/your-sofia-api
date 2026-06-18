import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "obo_updates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"obo_id" varchar NOT NULL,
  	"locality" varchar,
  	"timespan_end" timestamp(3) with time zone,
  	"finalized_at" timestamp(3) with time zone,
  	"data" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "obo_updates_id" integer;

  CREATE UNIQUE INDEX "obo_updates_obo_id_idx" ON "obo_updates" USING btree ("obo_id");
  CREATE INDEX "obo_updates_locality_idx" ON "obo_updates" USING btree ("locality");
  CREATE INDEX "obo_updates_timespan_end_idx" ON "obo_updates" USING btree ("timespan_end");
  CREATE INDEX "obo_updates_finalized_at_idx" ON "obo_updates" USING btree ("finalized_at");
  CREATE INDEX "obo_updates_updated_at_idx" ON "obo_updates" USING btree ("updated_at");
  CREATE INDEX "obo_updates_created_at_idx" ON "obo_updates" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_obo_updates_fk" FOREIGN KEY ("obo_updates_id") REFERENCES "public"."obo_updates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_obo_updates_id_idx" ON "payload_locked_documents_rels" USING btree ("obo_updates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "obo_updates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "obo_updates" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_obo_updates_fk";

  DROP INDEX "payload_locked_documents_rels_obo_updates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "obo_updates_id";`)
}
