import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_waste_containers_collection_days_of_week" AS ENUM('1', '2', '3', '4', '5', '6', '7');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncWasteCollectionSchedules' BEFORE 'createCollectionExport';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncWasteCollectionSchedules' BEFORE 'createCollectionExport';
  CREATE TABLE "waste_containers_collection_days_of_week" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_waste_containers_collection_days_of_week",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "waste_containers" ADD COLUMN "collection_times_per_day" numeric DEFAULT 1;
  ALTER TABLE "waste_containers" ADD COLUMN "schedule_source" varchar;
  ALTER TABLE "waste_containers_collection_days_of_week" ADD CONSTRAINT "waste_containers_collection_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."waste_containers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "waste_containers_collection_days_of_week_order_idx" ON "waste_containers_collection_days_of_week" USING btree ("order");
  CREATE INDEX "waste_containers_collection_days_of_week_parent_idx" ON "waste_containers_collection_days_of_week" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "waste_containers_collection_days_of_week" CASCADE;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'processWasteCollectionEvents', 'createCollectionExport', 'createCollectionImport', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'processWasteCollectionEvents', 'createCollectionExport', 'createCollectionImport', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "waste_containers" DROP COLUMN "collection_times_per_day";
  ALTER TABLE "waste_containers" DROP COLUMN "schedule_source";
  DROP TYPE "public"."enum_waste_containers_collection_days_of_week";`)
}
