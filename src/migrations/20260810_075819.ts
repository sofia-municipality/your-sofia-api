import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
	await db.execute(sql`
	 CREATE TYPE "public"."enum_textile_containers_status" AS ENUM('full', 'damaged', 'open');
	CREATE TYPE "public"."enum_signals_textile_state" AS ENUM('full', 'damaged', 'open');
	ALTER TYPE "public"."enum_signals_category" ADD VALUE 'textile-container' BEFORE 'drinking-fountain';
	ALTER TYPE "public"."enum_signals_city_object_type" ADD VALUE 'textile-container' BEFORE 'drinking-fountain';
	CREATE TABLE "textile_containers" (
		"id" serial PRIMARY KEY NOT NULL,
		"number" numeric,
		"district_id" integer,
		"company_id" integer,
		"address" varchar NOT NULL,
		"location" geometry(Point) NOT NULL,
		"status" "enum_textile_containers_status",
		"notes" varchar,
		"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
		"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
	);

	CREATE TABLE "textile_companies" (
		"id" serial PRIMARY KEY NOT NULL,
		"name" varchar NOT NULL,
		"phone" varchar,
		"email" varchar,
		"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
		"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
	);

	CREATE TABLE "signals_textile_state" (
		"order" integer NOT NULL,
		"parent_id" integer NOT NULL,
		"value" "enum_signals_textile_state",
		"id" serial PRIMARY KEY NOT NULL
	);

	ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "textile_containers_id" integer;
	ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "textile_companies_id" integer;
	ALTER TABLE "textile_containers" ADD CONSTRAINT "textile_containers_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
	ALTER TABLE "textile_containers" ADD CONSTRAINT "textile_containers_company_id_textile_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."textile_companies"("id") ON DELETE set null ON UPDATE no action;
	ALTER TABLE "signals_textile_state" ADD CONSTRAINT "signals_textile_state_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
	CREATE INDEX "textile_containers_number_idx" ON "textile_containers" USING btree ("number");
	CREATE INDEX "textile_containers_district_idx" ON "textile_containers" USING btree ("district_id");
	CREATE INDEX "textile_containers_company_idx" ON "textile_containers" USING btree ("company_id");
	CREATE INDEX "textile_containers_status_idx" ON "textile_containers" USING btree ("status");
	CREATE INDEX "textile_containers_updated_at_idx" ON "textile_containers" USING btree ("updated_at");
	CREATE INDEX "textile_containers_created_at_idx" ON "textile_containers" USING btree ("created_at");
	CREATE UNIQUE INDEX "textile_companies_name_idx" ON "textile_companies" USING btree ("name");
	CREATE INDEX "textile_companies_updated_at_idx" ON "textile_companies" USING btree ("updated_at");
	CREATE INDEX "textile_companies_created_at_idx" ON "textile_companies" USING btree ("created_at");
	CREATE INDEX "signals_textile_state_order_idx" ON "signals_textile_state" USING btree ("order");
	CREATE INDEX "signals_textile_state_parent_idx" ON "signals_textile_state" USING btree ("parent_id");
	ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_textile_containers_fk" FOREIGN KEY ("textile_containers_id") REFERENCES "public"."textile_containers"("id") ON DELETE cascade ON UPDATE no action;
	ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_textile_companies_fk" FOREIGN KEY ("textile_companies_id") REFERENCES "public"."textile_companies"("id") ON DELETE cascade ON UPDATE no action;
	CREATE INDEX "payload_locked_documents_rels_textile_containers_id_idx" ON "payload_locked_documents_rels" USING btree ("textile_containers_id");
	CREATE INDEX "payload_locked_documents_rels_textile_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("textile_companies_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
	await db.execute(sql`
	 ALTER TABLE "textile_containers" DISABLE ROW LEVEL SECURITY;
	ALTER TABLE "textile_companies" DISABLE ROW LEVEL SECURITY;
	ALTER TABLE "signals_textile_state" DISABLE ROW LEVEL SECURITY;
	DROP TABLE "textile_containers" CASCADE;
	DROP TABLE "textile_companies" CASCADE;
	DROP TABLE "signals_textile_state" CASCADE;
	ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE text;
	ALTER TABLE "signals" ALTER COLUMN "category" SET DEFAULT 'other'::text;
	DROP TYPE "public"."enum_signals_category";
	CREATE TYPE "public"."enum_signals_category" AS ENUM('waste-container', 'drinking-fountain', 'street-damage', 'lighting', 'green-spaces', 'parking', 'public-transport', 'other');
	ALTER TABLE "signals" ALTER COLUMN "category" SET DEFAULT 'other'::"public"."enum_signals_category";
	ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE "public"."enum_signals_category" USING "category"::"public"."enum_signals_category";
	ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE text;
	DROP TYPE "public"."enum_signals_city_object_type";
	CREATE TYPE "public"."enum_signals_city_object_type" AS ENUM('waste-container', 'drinking-fountain', 'street', 'park', 'building', 'other');
	ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE "public"."enum_signals_city_object_type" USING "city_object_type"::"public"."enum_signals_city_object_type";
	DROP INDEX "payload_locked_documents_rels_textile_containers_id_idx";
	DROP INDEX "payload_locked_documents_rels_textile_companies_id_idx";
	ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "textile_containers_id";
	ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "textile_companies_id";
	DROP TYPE "public"."enum_textile_containers_status";
	DROP TYPE "public"."enum_signals_textile_state";`)
}
