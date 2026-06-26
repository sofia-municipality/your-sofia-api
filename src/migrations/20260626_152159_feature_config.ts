import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "feature_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar NOT NULL,
  	"enabled" boolean DEFAULT false NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "feature_config_id" integer;
  CREATE UNIQUE INDEX "feature_config_feature_idx" ON "feature_config" USING btree ("feature");
  CREATE INDEX "feature_config_updated_at_idx" ON "feature_config" USING btree ("updated_at");
  CREATE INDEX "feature_config_created_at_idx" ON "feature_config" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feature_config_fk" FOREIGN KEY ("feature_config_id") REFERENCES "public"."feature_config"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_feature_config_id_idx" ON "payload_locked_documents_rels" USING btree ("feature_config_id");
  
  INSERT INTO "feature_config" ("feature", "enabled", "description") VALUES ('enable_container_creation_on_collection', false, 'When enabled, automatically creates a pending waste container when a GPS collection event occurs at an unrecognised location. Disabled by default — enable only after verifying GPS data quality.');
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "feature_config" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "feature_config" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_feature_config_fk";
  
  DROP INDEX "payload_locked_documents_rels_feature_config_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "feature_config_id";`)
}
