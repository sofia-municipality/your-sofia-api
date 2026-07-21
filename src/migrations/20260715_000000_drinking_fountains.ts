import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- ── Lookup tables ─────────────────────────────────────────────────────────
   CREATE TABLE "drinking_fountain_source" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

   CREATE TABLE "fountain_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

   CREATE TABLE "fountain_owner" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

   CREATE TABLE "fountain_activation_type" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

   -- ── Main table ────────────────────────────────────────────────────────────
   CREATE TABLE "drinking_fountains" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"address" varchar NOT NULL,
  	"location" geometry(Point) NOT NULL,
  	"status_id" integer,
  	"activation_type_id" integer,
  	"is_active" boolean,
  	"protection_status" varchar,
  	"external_link" varchar,
  	"district_id" integer,
  	"source_id" integer,
  	"owner_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

   -- ── Locked-documents relationship columns (Payload admin locking) ─────────
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drinking_fountains_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drinking_fountain_source_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fountain_status_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fountain_owner_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fountain_activation_type_id" integer;

   -- ── Foreign keys ──────────────────────────────────────────────────────────
   ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_source_id_drinking_fountain_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."drinking_fountain_source"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_status_id_fountain_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."fountain_status"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_owner_id_fountain_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."fountain_owner"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_activation_type_id_fountain_activation_type_id_fk" FOREIGN KEY ("activation_type_id") REFERENCES "public"."fountain_activation_type"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drinking_fountains_fk" FOREIGN KEY ("drinking_fountains_id") REFERENCES "public"."drinking_fountains"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drinking_fountain_source_fk" FOREIGN KEY ("drinking_fountain_source_id") REFERENCES "public"."drinking_fountain_source"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fountain_status_fk" FOREIGN KEY ("fountain_status_id") REFERENCES "public"."fountain_status"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fountain_owner_fk" FOREIGN KEY ("fountain_owner_id") REFERENCES "public"."fountain_owner"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fountain_activation_type_fk" FOREIGN KEY ("fountain_activation_type_id") REFERENCES "public"."fountain_activation_type"("id") ON DELETE cascade ON UPDATE no action;

   -- ── Indexes ───────────────────────────────────────────────────────────────
   CREATE UNIQUE INDEX "drinking_fountain_source_name_idx" ON "drinking_fountain_source" USING btree ("name");
   CREATE INDEX "drinking_fountain_source_updated_at_idx" ON "drinking_fountain_source" USING btree ("updated_at");
   CREATE INDEX "drinking_fountain_source_created_at_idx" ON "drinking_fountain_source" USING btree ("created_at");
   CREATE UNIQUE INDEX "fountain_status_name_idx" ON "fountain_status" USING btree ("name");
   CREATE INDEX "fountain_status_updated_at_idx" ON "fountain_status" USING btree ("updated_at");
   CREATE INDEX "fountain_status_created_at_idx" ON "fountain_status" USING btree ("created_at");
   CREATE UNIQUE INDEX "fountain_owner_name_idx" ON "fountain_owner" USING btree ("name");
   CREATE INDEX "fountain_owner_updated_at_idx" ON "fountain_owner" USING btree ("updated_at");
   CREATE INDEX "fountain_owner_created_at_idx" ON "fountain_owner" USING btree ("created_at");
   CREATE UNIQUE INDEX "fountain_activation_type_name_idx" ON "fountain_activation_type" USING btree ("name");
   CREATE INDEX "fountain_activation_type_updated_at_idx" ON "fountain_activation_type" USING btree ("updated_at");
   CREATE INDEX "fountain_activation_type_created_at_idx" ON "fountain_activation_type" USING btree ("created_at");
   CREATE INDEX "drinking_fountains_district_idx" ON "drinking_fountains" USING btree ("district_id");
   CREATE INDEX "drinking_fountains_source_idx" ON "drinking_fountains" USING btree ("source_id");
   CREATE INDEX "drinking_fountains_status_idx" ON "drinking_fountains" USING btree ("status_id");
   CREATE INDEX "drinking_fountains_owner_idx" ON "drinking_fountains" USING btree ("owner_id");
   CREATE INDEX "drinking_fountains_activation_type_idx" ON "drinking_fountains" USING btree ("activation_type_id");
   CREATE INDEX "drinking_fountains_updated_at_idx" ON "drinking_fountains" USING btree ("updated_at");
   CREATE INDEX "drinking_fountains_created_at_idx" ON "drinking_fountains" USING btree ("created_at");
   CREATE INDEX "drinking_fountains_location_idx" ON "drinking_fountains" USING GIST ("location");
   CREATE INDEX "payload_locked_documents_rels_drinking_fountains_id_idx" ON "payload_locked_documents_rels" USING btree ("drinking_fountains_id");
   CREATE INDEX "payload_locked_documents_rels_drinking_fountain_source_id_idx" ON "payload_locked_documents_rels" USING btree ("drinking_fountain_source_id");
   CREATE INDEX "payload_locked_documents_rels_fountain_status_id_idx" ON "payload_locked_documents_rels" USING btree ("fountain_status_id");
   CREATE INDEX "payload_locked_documents_rels_fountain_owner_id_idx" ON "payload_locked_documents_rels" USING btree ("fountain_owner_id");
   CREATE INDEX "payload_locked_documents_rels_fountain_activation_type_id_idx" ON "payload_locked_documents_rels" USING btree ("fountain_activation_type_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drinking_fountains" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "drinking_fountain_source" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "fountain_status" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "fountain_owner" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "fountain_activation_type" DISABLE ROW LEVEL SECURITY;

   DROP TABLE "drinking_fountains" CASCADE;
   DROP TABLE "drinking_fountain_source" CASCADE;
   DROP TABLE "fountain_status" CASCADE;
   DROP TABLE "fountain_owner" CASCADE;
   DROP TABLE "fountain_activation_type" CASCADE;

   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_drinking_fountains_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_drinking_fountain_source_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fountain_status_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fountain_owner_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fountain_activation_type_fk";

   DROP INDEX IF EXISTS "payload_locked_documents_rels_drinking_fountains_id_idx";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_drinking_fountain_source_id_idx";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_fountain_status_id_idx";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_fountain_owner_id_idx";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_fountain_activation_type_id_idx";

   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "drinking_fountains_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "drinking_fountain_source_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fountain_status_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fountain_owner_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fountain_activation_type_id";`)
}
