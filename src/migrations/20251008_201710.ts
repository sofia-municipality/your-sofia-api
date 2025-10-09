import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_waste_containers_capacity_size" AS ENUM('tiny', 'small', 'standard', 'big', 'industrial');
  CREATE TYPE "public"."enum_waste_containers_waste_type" AS ENUM('general', 'recyclables', 'organic', 'glass', 'paper', 'plastic', 'metal');
  CREATE TYPE "public"."enum_waste_containers_status" AS ENUM('active', 'full', 'maintenance', 'inactive');
  CREATE TYPE "public"."enum_signals_container_state" AS ENUM('full', 'dirty', 'damaged');
  CREATE TYPE "public"."enum_signals_category" AS ENUM('waste-container', 'street-damage', 'lighting', 'green-spaces', 'parking', 'public-transport', 'other');
  CREATE TYPE "public"."enum_signals_city_object_type" AS ENUM('waste-container', 'street', 'park', 'building', 'other');
  CREATE TYPE "public"."enum_signals_status" AS ENUM('pending', 'in-progress', 'resolved', 'rejected');
  ALTER TYPE "public"."enum_news_topic" ADD VALUE 'alerts';
  CREATE TABLE IF NOT EXISTS "waste_containers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"public_number" varchar NOT NULL,
  	"image_id" integer,
  	"location_latitude" numeric NOT NULL,
  	"location_longitude" numeric NOT NULL,
  	"location_address" varchar,
  	"capacity_volume" numeric NOT NULL,
  	"capacity_size" "enum_waste_containers_capacity_size" DEFAULT 'standard' NOT NULL,
  	"service_interval" varchar,
  	"serviced_by" varchar,
  	"waste_type" "enum_waste_containers_waste_type" DEFAULT 'general' NOT NULL,
  	"status" "enum_waste_containers_status" DEFAULT 'active' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "signals_container_state" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_signals_container_state",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "signals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum_signals_category" DEFAULT 'other' NOT NULL,
  	"city_object_type" "enum_signals_city_object_type",
  	"city_object_reference_id" varchar,
  	"city_object_name" varchar,
  	"location_latitude" numeric,
  	"location_longitude" numeric,
  	"location_address" varchar,
  	"status" "enum_signals_status" DEFAULT 'pending' NOT NULL,
  	"admin_notes" varchar,
  	"reporter_unique_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "signals_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "signals_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "waste_containers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "signals_id" integer;
  DO $$ BEGIN
   ALTER TABLE "waste_containers" ADD CONSTRAINT "waste_containers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "signals_container_state" ADD CONSTRAINT "signals_container_state_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "signals_locales" ADD CONSTRAINT "signals_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "signals_rels" ADD CONSTRAINT "signals_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "signals_rels" ADD CONSTRAINT "signals_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE UNIQUE INDEX IF NOT EXISTS "waste_containers_public_number_idx" ON "waste_containers" USING btree ("public_number");
  CREATE INDEX IF NOT EXISTS "waste_containers_image_idx" ON "waste_containers" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "waste_containers_updated_at_idx" ON "waste_containers" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "waste_containers_created_at_idx" ON "waste_containers" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "signals_container_state_order_idx" ON "signals_container_state" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "signals_container_state_parent_idx" ON "signals_container_state" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "signals_updated_at_idx" ON "signals" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "signals_created_at_idx" ON "signals" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "signals_locales_locale_parent_id_unique" ON "signals_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX IF NOT EXISTS "signals_rels_order_idx" ON "signals_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "signals_rels_parent_idx" ON "signals_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "signals_rels_path_idx" ON "signals_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "signals_rels_media_id_idx" ON "signals_rels" USING btree ("media_id");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waste_containers_fk" FOREIGN KEY ("waste_containers_id") REFERENCES "public"."waste_containers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signals_fk" FOREIGN KEY ("signals_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_waste_containers_id_idx" ON "payload_locked_documents_rels" USING btree ("waste_containers_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_signals_id_idx" ON "payload_locked_documents_rels" USING btree ("signals_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "waste_containers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals_container_state" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "waste_containers" CASCADE;
  DROP TABLE "signals_container_state" CASCADE;
  DROP TABLE "signals" CASCADE;
  DROP TABLE "signals_locales" CASCADE;
  DROP TABLE "signals_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_waste_containers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_signals_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_waste_containers_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_signals_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "waste_containers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "signals_id";
  ALTER TABLE "public"."news" ALTER COLUMN "topic" SET DATA TYPE text;
  DROP TYPE "public"."enum_news_topic";
  CREATE TYPE "public"."enum_news_topic" AS ENUM('festivals', 'street-closure', 'city-events');
  ALTER TABLE "public"."news" ALTER COLUMN "topic" SET DATA TYPE "public"."enum_news_topic" USING "topic"::"public"."enum_news_topic";
  DROP TYPE "public"."enum_waste_containers_capacity_size";
  DROP TYPE "public"."enum_waste_containers_waste_type";
  DROP TYPE "public"."enum_waste_containers_status";
  DROP TYPE "public"."enum_signals_container_state";
  DROP TYPE "public"."enum_signals_category";
  DROP TYPE "public"."enum_signals_city_object_type";
  DROP TYPE "public"."enum_signals_status";`)
}
