import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bulky_waste_zones_collection_days_of_week" AS ENUM('1', '2', '3', '4', '5', '6', '7');
  CREATE TABLE "bulky_waste_zones_collection_days_of_week" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_bulky_waste_zones_collection_days_of_week",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "bulky_waste_zones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_id" numeric NOT NULL,
  	"name" varchar NOT NULL,
  	"info" varchar,
  	"boundary" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bulky_waste_zones_id" integer;
  ALTER TABLE "bulky_waste_zones_collection_days_of_week" ADD CONSTRAINT "bulky_waste_zones_collection_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bulky_waste_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bulky_waste_zones_collection_days_of_week_order_idx" ON "bulky_waste_zones_collection_days_of_week" USING btree ("order");
  CREATE INDEX "bulky_waste_zones_collection_days_of_week_parent_idx" ON "bulky_waste_zones_collection_days_of_week" USING btree ("parent_id");
  CREATE UNIQUE INDEX "bulky_waste_zones_source_id_idx" ON "bulky_waste_zones" USING btree ("source_id");
  CREATE INDEX "bulky_waste_zones_updated_at_idx" ON "bulky_waste_zones" USING btree ("updated_at");
  CREATE INDEX "bulky_waste_zones_created_at_idx" ON "bulky_waste_zones" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bulky_waste_zones_fk" FOREIGN KEY ("bulky_waste_zones_id") REFERENCES "public"."bulky_waste_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_bulky_waste_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("bulky_waste_zones_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bulky_waste_zones_collection_days_of_week" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bulky_waste_zones" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bulky_waste_zones_collection_days_of_week" CASCADE;
  DROP TABLE "bulky_waste_zones" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bulky_waste_zones_fk";
  
  DROP INDEX "payload_locked_documents_rels_bulky_waste_zones_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bulky_waste_zones_id";
  DROP TYPE "public"."enum_bulky_waste_zones_collection_days_of_week";`)
}
