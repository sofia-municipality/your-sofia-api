import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bulky_waste_zones" (
      "id" serial PRIMARY KEY NOT NULL,
      "source_id" numeric NOT NULL,
      "name" varchar NOT NULL,
      "info" varchar,
      "boundary" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      CREATE TYPE "public"."enum_bulky_waste_zones_collection_days_of_week" AS ENUM('1', '2', '3', '4', '5', '6', '7');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "bulky_waste_zones_collection_days_of_week" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_bulky_waste_zones_collection_days_of_week",
      "id" serial PRIMARY KEY NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "bulky_waste_zones_id" integer;
    CREATE UNIQUE INDEX IF NOT EXISTS "bulky_waste_zones_source_id_idx" ON "bulky_waste_zones" USING btree ("source_id");
    DO $$ BEGIN
      ALTER TABLE "bulky_waste_zones_collection_days_of_week" ADD CONSTRAINT "bulky_waste_zones_collection_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bulky_waste_zones"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "bulky_waste_zones_collection_days_of_week_order_idx" ON "bulky_waste_zones_collection_days_of_week" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "bulky_waste_zones_collection_days_of_week_parent_idx" ON "bulky_waste_zones_collection_days_of_week" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "bulky_waste_zones_updated_at_idx" ON "bulky_waste_zones" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "bulky_waste_zones_created_at_idx" ON "bulky_waste_zones" USING btree ("created_at");
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bulky_waste_zones_fk" FOREIGN KEY ("bulky_waste_zones_id") REFERENCES "public"."bulky_waste_zones"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bulky_waste_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("bulky_waste_zones_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bulky_waste_zones_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_bulky_waste_zones_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bulky_waste_zones_id";
    DROP TABLE IF EXISTS "bulky_waste_zones_collection_days_of_week" CASCADE;
    DROP TABLE IF EXISTS "bulky_waste_zones";
    DROP TYPE IF EXISTS "public"."enum_bulky_waste_zones_collection_days_of_week";
  `)
}
