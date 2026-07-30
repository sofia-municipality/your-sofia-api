import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_drinking_fountains_status" AS ENUM('Добро', 'За възстановяване', 'За ремонт', 'За основен ремонт', 'Отлично', 'Задоволително', 'Незадоволително', 'Не работи', 'Няма информация');
  CREATE TYPE "public"."enum_drinking_fountains_activation_type" AS ENUM('Бутон', 'Кран', 'Да', 'Не');
  CREATE TYPE "public"."enum_signals_fountain_state" AS ENUM('notWorking', 'damaged', 'dirty', 'leaking', 'other');
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'fountainAdmin' BEFORE 'inspector';
  ALTER TYPE "public"."enum_signals_category" ADD VALUE 'drinking-fountain' BEFORE 'street-damage';
  ALTER TYPE "public"."enum_signals_city_object_type" ADD VALUE 'drinking-fountain' BEFORE 'street';
  CREATE TABLE "drinking_fountains" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"public_number" varchar,
  	"district_id" integer,
  	"source_id" integer,
  	"owner_id" integer,
  	"address" varchar NOT NULL,
  	"location" geometry(Point) NOT NULL,
  	"status" "enum_drinking_fountains_status",
  	"activation_type" "enum_drinking_fountains_activation_type",
  	"is_active" boolean,
  	"protection_status" varchar,
  	"external_link" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "drinking_fountain_source" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fountain_owner" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"contact_email" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "signals_fountain_state" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_signals_fountain_state",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drinking_fountains_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drinking_fountain_source_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fountain_owner_id" integer;
  ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_source_id_drinking_fountain_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."drinking_fountain_source"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drinking_fountains" ADD CONSTRAINT "drinking_fountains_owner_id_fountain_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."fountain_owner"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals_fountain_state" ADD CONSTRAINT "signals_fountain_state_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "drinking_fountains_public_number_idx" ON "drinking_fountains" USING btree ("public_number");
  CREATE INDEX "drinking_fountains_district_idx" ON "drinking_fountains" USING btree ("district_id");
  CREATE INDEX "drinking_fountains_source_idx" ON "drinking_fountains" USING btree ("source_id");
  CREATE INDEX "drinking_fountains_owner_idx" ON "drinking_fountains" USING btree ("owner_id");
  CREATE INDEX "drinking_fountains_status_idx" ON "drinking_fountains" USING btree ("status");
  CREATE INDEX "drinking_fountains_updated_at_idx" ON "drinking_fountains" USING btree ("updated_at");
  CREATE INDEX "drinking_fountains_created_at_idx" ON "drinking_fountains" USING btree ("created_at");
  CREATE UNIQUE INDEX "drinking_fountain_source_name_idx" ON "drinking_fountain_source" USING btree ("name");
  CREATE INDEX "drinking_fountain_source_updated_at_idx" ON "drinking_fountain_source" USING btree ("updated_at");
  CREATE INDEX "drinking_fountain_source_created_at_idx" ON "drinking_fountain_source" USING btree ("created_at");
  CREATE UNIQUE INDEX "fountain_owner_name_idx" ON "fountain_owner" USING btree ("name");
  CREATE INDEX "fountain_owner_updated_at_idx" ON "fountain_owner" USING btree ("updated_at");
  CREATE INDEX "fountain_owner_created_at_idx" ON "fountain_owner" USING btree ("created_at");
  CREATE INDEX "signals_fountain_state_order_idx" ON "signals_fountain_state" USING btree ("order");
  CREATE INDEX "signals_fountain_state_parent_idx" ON "signals_fountain_state" USING btree ("parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drinking_fountains_fk" FOREIGN KEY ("drinking_fountains_id") REFERENCES "public"."drinking_fountains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drinking_fountain_source_fk" FOREIGN KEY ("drinking_fountain_source_id") REFERENCES "public"."drinking_fountain_source"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fountain_owner_fk" FOREIGN KEY ("fountain_owner_id") REFERENCES "public"."fountain_owner"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_drinking_fountains_id_idx" ON "payload_locked_documents_rels" USING btree ("drinking_fountains_id");
  CREATE INDEX "payload_locked_documents_rels_drinking_fountain_source_i_idx" ON "payload_locked_documents_rels" USING btree ("drinking_fountain_source_id");
  CREATE INDEX "payload_locked_documents_rels_fountain_owner_id_idx" ON "payload_locked_documents_rels" USING btree ("fountain_owner_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drinking_fountains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drinking_fountain_source" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fountain_owner" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals_fountain_state" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "drinking_fountains" CASCADE;
  DROP TABLE "drinking_fountain_source" CASCADE;
  DROP TABLE "fountain_owner" CASCADE;
  DROP TABLE "signals_fountain_state" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drinking_fountains_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drinking_fountain_source_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_fountain_owner_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin', 'containerAdmin', 'inspector', 'wasteCollector');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE text;
  ALTER TABLE "signals" ALTER COLUMN "category" SET DEFAULT 'other'::text;
  DROP TYPE "public"."enum_signals_category";
  CREATE TYPE "public"."enum_signals_category" AS ENUM('waste-container', 'street-damage', 'lighting', 'green-spaces', 'parking', 'public-transport', 'other');
  ALTER TABLE "signals" ALTER COLUMN "category" SET DEFAULT 'other'::"public"."enum_signals_category";
  ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE "public"."enum_signals_category" USING "category"::"public"."enum_signals_category";
  ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_signals_city_object_type";
  CREATE TYPE "public"."enum_signals_city_object_type" AS ENUM('waste-container', 'street', 'park', 'building', 'other');
  ALTER TABLE "signals" ALTER COLUMN "city_object_type" SET DATA TYPE "public"."enum_signals_city_object_type" USING "city_object_type"::"public"."enum_signals_city_object_type";
  DROP INDEX "payload_locked_documents_rels_drinking_fountains_id_idx";
  DROP INDEX "payload_locked_documents_rels_drinking_fountain_source_i_idx";
  DROP INDEX "payload_locked_documents_rels_fountain_owner_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drinking_fountains_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drinking_fountain_source_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fountain_owner_id";
  DROP TYPE "public"."enum_drinking_fountains_status";
  DROP TYPE "public"."enum_drinking_fountains_activation_type";
  DROP TYPE "public"."enum_signals_fountain_state";`)
}
