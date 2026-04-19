import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "waste_container_observations"
      DROP CONSTRAINT "waste_container_observations_container_id_waste_containers_id_fk";
    ALTER TABLE "waste_container_observations"
      ADD CONSTRAINT "waste_container_observations_container_id_waste_containers_id_fk"
      FOREIGN KEY ("container_id") REFERENCES "public"."waste_containers"("id")
      ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "waste_container_observations"
      DROP CONSTRAINT "waste_container_observations_container_id_waste_containers_id_fk";
    ALTER TABLE "waste_container_observations"
      ADD CONSTRAINT "waste_container_observations_container_id_waste_containers_id_fk"
      FOREIGN KEY ("container_id") REFERENCES "public"."waste_containers"("id")
      ON DELETE set null ON UPDATE no action;
  `)
}
