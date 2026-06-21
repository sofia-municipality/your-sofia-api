import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'syncWasteCollectionSchedules'`)
  } catch (_) {}
  try {
    await db.execute(sql`DELETE FROM "payload_jobs" WHERE "task_slug" = 'syncWasteCollectionSchedules'`)
  } catch (_) {}
  await db.execute(sql`
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'processWasteCollectionEvents', 'sendUpdatesNotifications', 'sendInspectorMetricsReport', 'createCollectionExport', 'createCollectionImport', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'processWasteCollectionEvents', 'sendUpdatesNotifications', 'sendInspectorMetricsReport', 'createCollectionExport', 'createCollectionImport', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncWasteCollectionSchedules' BEFORE 'sendUpdatesNotifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncWasteCollectionSchedules' BEFORE 'sendUpdatesNotifications';`)
}
