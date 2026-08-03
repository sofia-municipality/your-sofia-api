import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_missions_level" AS ENUM('good-first-mission', 'verified-contributor', 'verified-guardian');
  CREATE TYPE "public"."enum_missions_status" AS ENUM('draft', 'open', 'in_progress', 'ready_for_review', 'returned_for_improvement', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_missions_community_consensus" AS ENUM('none', 'trusted_verified', 'peer_verified', 'disputed');
  CREATE TYPE "public"."enum_mission_profiles_contributor_level" AS ENUM('beginner', 'contributor', 'guardian');
  CREATE TYPE "public"."enum_dar_points_transactions_reason" AS ENUM('mission_completed', 'mission_returned', 'manual_adjustment');
  CREATE TYPE "public"."enum_mission_verifications_decision" AS ENUM('approve', 'reject');
  CREATE TABLE "missions_tasks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"instructions" varchar NOT NULL,
  	"acceptance_criteria" varchar NOT NULL,
  	"requires_before_photo" boolean DEFAULT true,
  	"requires_after_photo" boolean DEFAULT true,
  	"before_photo_id" integer,
  	"after_photo_id" integer,
  	"completed_by_citizen_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "missions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"signal_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"level" "enum_missions_level" DEFAULT 'good-first-mission' NOT NULL,
  	"status" "enum_missions_status" DEFAULT 'draft' NOT NULL,
  	"points_reward" numeric DEFAULT 10 NOT NULL,
  	"points_awarded" numeric,
  	"general_instructions" varchar NOT NULL,
  	"inspector_id" integer,
  	"citizen_id" integer,
  	"claimed_at" timestamp(3) with time zone,
  	"submitted_for_review_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"inspector_review_notes" varchar,
  	"community_consensus" "enum_missions_community_consensus" DEFAULT 'none',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "missions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "mission_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"dar_points" numeric DEFAULT 0 NOT NULL,
  	"contributor_level" "enum_mission_profiles_contributor_level" DEFAULT 'beginner' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "dar_points_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"reason" "enum_dar_points_transactions_reason" DEFAULT 'mission_completed' NOT NULL,
  	"mission_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mission_verifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mission_id" integer NOT NULL,
  	"verifier_id" integer NOT NULL,
  	"decision" "enum_mission_verifications_decision" NOT NULL,
  	"comment" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "missions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mission_profiles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "dar_points_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mission_verifications_id" integer;
  ALTER TABLE "missions_tasks" ADD CONSTRAINT "missions_tasks_before_photo_id_media_id_fk" FOREIGN KEY ("before_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "missions_tasks" ADD CONSTRAINT "missions_tasks_after_photo_id_media_id_fk" FOREIGN KEY ("after_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "missions_tasks" ADD CONSTRAINT "missions_tasks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "missions" ADD CONSTRAINT "missions_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "missions" ADD CONSTRAINT "missions_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "missions" ADD CONSTRAINT "missions_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "missions_rels" ADD CONSTRAINT "missions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "missions_rels" ADD CONSTRAINT "missions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mission_profiles" ADD CONSTRAINT "mission_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dar_points_transactions" ADD CONSTRAINT "dar_points_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dar_points_transactions" ADD CONSTRAINT "dar_points_transactions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mission_verifications" ADD CONSTRAINT "mission_verifications_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mission_verifications" ADD CONSTRAINT "mission_verifications_verifier_id_users_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "missions_tasks_order_idx" ON "missions_tasks" USING btree ("_order");
  CREATE INDEX "missions_tasks_parent_id_idx" ON "missions_tasks" USING btree ("_parent_id");
  CREATE INDEX "missions_tasks_before_photo_idx" ON "missions_tasks" USING btree ("before_photo_id");
  CREATE INDEX "missions_tasks_after_photo_idx" ON "missions_tasks" USING btree ("after_photo_id");
  CREATE INDEX "missions_signal_idx" ON "missions" USING btree ("signal_id");
  CREATE INDEX "missions_level_idx" ON "missions" USING btree ("level");
  CREATE INDEX "missions_status_idx" ON "missions" USING btree ("status");
  CREATE INDEX "missions_inspector_idx" ON "missions" USING btree ("inspector_id");
  CREATE INDEX "missions_citizen_idx" ON "missions" USING btree ("citizen_id");
  CREATE INDEX "missions_updated_at_idx" ON "missions" USING btree ("updated_at");
  CREATE INDEX "missions_created_at_idx" ON "missions" USING btree ("created_at");
  CREATE INDEX "missions_rels_order_idx" ON "missions_rels" USING btree ("order");
  CREATE INDEX "missions_rels_parent_idx" ON "missions_rels" USING btree ("parent_id");
  CREATE INDEX "missions_rels_path_idx" ON "missions_rels" USING btree ("path");
  CREATE INDEX "missions_rels_media_id_idx" ON "missions_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "mission_profiles_user_idx" ON "mission_profiles" USING btree ("user_id");
  CREATE INDEX "mission_profiles_updated_at_idx" ON "mission_profiles" USING btree ("updated_at");
  CREATE INDEX "mission_profiles_created_at_idx" ON "mission_profiles" USING btree ("created_at");
  CREATE UNIQUE INDEX "dar_points_transactions_idempotency_key_idx" ON "dar_points_transactions" USING btree ("idempotency_key");
  CREATE INDEX "dar_points_transactions_user_idx" ON "dar_points_transactions" USING btree ("user_id");
  CREATE INDEX "dar_points_transactions_mission_idx" ON "dar_points_transactions" USING btree ("mission_id");
  CREATE INDEX "dar_points_transactions_updated_at_idx" ON "dar_points_transactions" USING btree ("updated_at");
  CREATE INDEX "dar_points_transactions_created_at_idx" ON "dar_points_transactions" USING btree ("created_at");
  CREATE INDEX "mission_verifications_mission_idx" ON "mission_verifications" USING btree ("mission_id");
  CREATE INDEX "mission_verifications_verifier_idx" ON "mission_verifications" USING btree ("verifier_id");
  CREATE INDEX "mission_verifications_updated_at_idx" ON "mission_verifications" USING btree ("updated_at");
  CREATE INDEX "mission_verifications_created_at_idx" ON "mission_verifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "mission_verifier_idx" ON "mission_verifications" USING btree ("mission_id","verifier_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_missions_fk" FOREIGN KEY ("missions_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mission_profiles_fk" FOREIGN KEY ("mission_profiles_id") REFERENCES "public"."mission_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dar_points_transactions_fk" FOREIGN KEY ("dar_points_transactions_id") REFERENCES "public"."dar_points_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mission_verifications_fk" FOREIGN KEY ("mission_verifications_id") REFERENCES "public"."mission_verifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_missions_id_idx" ON "payload_locked_documents_rels" USING btree ("missions_id");
  CREATE INDEX "payload_locked_documents_rels_mission_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("mission_profiles_id");
  CREATE INDEX "payload_locked_documents_rels_dar_points_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("dar_points_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_mission_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("mission_verifications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "missions_tasks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "missions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "missions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mission_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "dar_points_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mission_verifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "missions_tasks" CASCADE;
  DROP TABLE "missions" CASCADE;
  DROP TABLE "missions_rels" CASCADE;
  DROP TABLE "mission_profiles" CASCADE;
  DROP TABLE "dar_points_transactions" CASCADE;
  DROP TABLE "mission_verifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_missions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mission_profiles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_dar_points_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mission_verifications_fk";
  
  DROP INDEX "payload_locked_documents_rels_missions_id_idx";
  DROP INDEX "payload_locked_documents_rels_mission_profiles_id_idx";
  DROP INDEX "payload_locked_documents_rels_dar_points_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_mission_verifications_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "missions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mission_profiles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "dar_points_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mission_verifications_id";
  DROP TYPE "public"."enum_missions_level";
  DROP TYPE "public"."enum_missions_status";
  DROP TYPE "public"."enum_missions_community_consensus";
  DROP TYPE "public"."enum_mission_profiles_contributor_level";
  DROP TYPE "public"."enum_dar_points_transactions_reason";
  DROP TYPE "public"."enum_mission_verifications_decision";`)
}
