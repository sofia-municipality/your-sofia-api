import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_waste_containers_state" AS ENUM('full', 'dirty', 'damaged', 'empty', 'maintenance', 'forCollection', 'fallen', 'bulkyWaste');
  CREATE TABLE "waste_containers_state" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_waste_containers_state",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "waste_containers_state" ADD CONSTRAINT "waste_containers_state_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."waste_containers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "waste_containers_state_order_idx" ON "waste_containers_state" USING btree ("order");
  CREATE INDEX "waste_containers_state_parent_idx" ON "waste_containers_state" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "waste_containers_state" CASCADE;
  DROP TYPE "public"."enum_waste_containers_state";`)
}
