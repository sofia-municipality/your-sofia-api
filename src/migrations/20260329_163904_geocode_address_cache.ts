import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "geocode_addresses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"address" varchar NOT NULL,
  	"district_hint" varchar NOT NULL,
  	"location" geometry(Point),
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "geocode_addresses_id" integer;
  CREATE INDEX "geocode_addresses_updated_at_idx" ON "geocode_addresses" USING btree ("updated_at");
  CREATE INDEX "geocode_addresses_created_at_idx" ON "geocode_addresses" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_geocode_addresses_fk" FOREIGN KEY ("geocode_addresses_id") REFERENCES "public"."geocode_addresses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_geocode_addresses_id_idx" ON "payload_locked_documents_rels" USING btree ("geocode_addresses_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "geocode_addresses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "geocode_addresses" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_geocode_addresses_fk";
  
  DROP INDEX "payload_locked_documents_rels_geocode_addresses_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "geocode_addresses_id";`)
}
