import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "push_tokens" ADD COLUMN "reporter_unique_id" varchar;
  CREATE INDEX "push_tokens_reporter_unique_id_idx" ON "push_tokens" USING btree ("reporter_unique_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "push_tokens_reporter_unique_id_idx";
  ALTER TABLE "push_tokens" DROP COLUMN "reporter_unique_id";`
  )
}
