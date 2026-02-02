import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_assignments_activities" AS ENUM('full', 'dirty', 'damaged', 'leaves', 'maintenance', 'bagged', 'fallen', 'bulkyWaste');
  CREATE TYPE "public"."enum_assignments_status" AS ENUM('pending', 'in-progress', 'completed', 'cancelled');
  ALTER TYPE "public"."enum_waste_containers_waste_type" ADD VALUE 'trashCan';
  CREATE TABLE "assignments_activities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_assignments_activities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"assigned_to_id" integer NOT NULL,
  	"status" "enum_assignments_status" DEFAULT 'pending' NOT NULL,
  	"due_date" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "assignments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"waste_containers_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "assignments_id" integer;
  ALTER TABLE "assignments_activities" ADD CONSTRAINT "assignments_activities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignments_rels" ADD CONSTRAINT "assignments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments_rels" ADD CONSTRAINT "assignments_rels_waste_containers_fk" FOREIGN KEY ("waste_containers_id") REFERENCES "public"."waste_containers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "assignments_activities_order_idx" ON "assignments_activities" USING btree ("order");
  CREATE INDEX "assignments_activities_parent_idx" ON "assignments_activities" USING btree ("parent_id");
  CREATE INDEX "assignments_assigned_to_idx" ON "assignments" USING btree ("assigned_to_id");
  CREATE INDEX "assignments_updated_at_idx" ON "assignments" USING btree ("updated_at");
  CREATE INDEX "assignments_created_at_idx" ON "assignments" USING btree ("created_at");
  CREATE INDEX "assignments_rels_order_idx" ON "assignments_rels" USING btree ("order");
  CREATE INDEX "assignments_rels_parent_idx" ON "assignments_rels" USING btree ("parent_id");
  CREATE INDEX "assignments_rels_path_idx" ON "assignments_rels" USING btree ("path");
  CREATE INDEX "assignments_rels_waste_containers_id_idx" ON "assignments_rels" USING btree ("waste_containers_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk" FOREIGN KEY ("assignments_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("assignments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "assignments_activities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignments_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "assignments_activities" CASCADE;
  DROP TABLE "assignments" CASCADE;
  DROP TABLE "assignments_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_assignments_fk";
  
  ALTER TABLE "waste_containers" ALTER COLUMN "waste_type" SET DATA TYPE text;
  ALTER TABLE "waste_containers" ALTER COLUMN "waste_type" SET DEFAULT 'general'::text;
  DROP TYPE "public"."enum_waste_containers_waste_type";
  CREATE TYPE "public"."enum_waste_containers_waste_type" AS ENUM('general', 'recyclables', 'organic', 'glass', 'paper', 'plastic', 'metal');
  ALTER TABLE "waste_containers" ALTER COLUMN "waste_type" SET DEFAULT 'general'::"public"."enum_waste_containers_waste_type";
  ALTER TABLE "waste_containers" ALTER COLUMN "waste_type" SET DATA TYPE "public"."enum_waste_containers_waste_type" USING "waste_type"::"public"."enum_waste_containers_waste_type";
  DROP INDEX "payload_locked_documents_rels_assignments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "assignments_id";
  DROP TYPE "public"."enum_assignments_activities";
  DROP TYPE "public"."enum_assignments_status";`)
}
