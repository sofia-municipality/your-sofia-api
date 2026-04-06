import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_subscriptions_location_filters_filter_type" AS ENUM('all', 'district', 'point', 'area');
  CREATE TABLE "news_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "subscriptions_location_filters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"filter_type" "enum_subscriptions_location_filters_filter_type" DEFAULT 'all' NOT NULL,
  	"district_id" integer,
  	"latitude" numeric,
  	"longitude" numeric,
  	"radius" numeric,
  	"polygon" jsonb
  );
  
  CREATE TABLE "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"push_token_id" integer NOT NULL,
  	"user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscriptions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  ALTER TABLE "news" ADD COLUMN "district_id" integer;
  ALTER TABLE "push_tokens" ADD COLUMN "user_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions_location_filters" ADD CONSTRAINT "subscriptions_location_filters_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions_location_filters" ADD CONSTRAINT "subscriptions_location_filters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_push_token_id_push_tokens_id_fk" FOREIGN KEY ("push_token_id") REFERENCES "public"."push_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions_rels" ADD CONSTRAINT "subscriptions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions_rels" ADD CONSTRAINT "subscriptions_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "news_rels_order_idx" ON "news_rels" USING btree ("order");
  CREATE INDEX "news_rels_parent_idx" ON "news_rels" USING btree ("parent_id");
  CREATE INDEX "news_rels_path_idx" ON "news_rels" USING btree ("path");
  CREATE INDEX "news_rels_categories_id_idx" ON "news_rels" USING btree ("categories_id");
  CREATE INDEX "subscriptions_location_filters_order_idx" ON "subscriptions_location_filters" USING btree ("_order");
  CREATE INDEX "subscriptions_location_filters_parent_id_idx" ON "subscriptions_location_filters" USING btree ("_parent_id");
  CREATE INDEX "subscriptions_location_filters_district_idx" ON "subscriptions_location_filters" USING btree ("district_id");
  CREATE INDEX "subscriptions_push_token_idx" ON "subscriptions" USING btree ("push_token_id");
  CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX "subscriptions_rels_order_idx" ON "subscriptions_rels" USING btree ("order");
  CREATE INDEX "subscriptions_rels_parent_idx" ON "subscriptions_rels" USING btree ("parent_id");
  CREATE INDEX "subscriptions_rels_path_idx" ON "subscriptions_rels" USING btree ("path");
  CREATE INDEX "subscriptions_rels_categories_id_idx" ON "subscriptions_rels" USING btree ("categories_id");
  ALTER TABLE "news" ADD CONSTRAINT "news_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "news_district_idx" ON "news" USING btree ("district_id");
  CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions_location_filters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "news_rels" CASCADE;
  DROP TABLE "subscriptions_location_filters" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "subscriptions_rels" CASCADE;
  ALTER TABLE "news" DROP CONSTRAINT "news_district_id_city_districts_id_fk";
  
  ALTER TABLE "push_tokens" DROP CONSTRAINT "push_tokens_user_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscriptions_fk";
  
  DROP INDEX "news_district_idx";
  DROP INDEX "push_tokens_user_idx";
  DROP INDEX "payload_locked_documents_rels_subscriptions_id_idx";
  ALTER TABLE "news" DROP COLUMN "district_id";
  ALTER TABLE "push_tokens" DROP COLUMN "user_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscriptions_id";
  DROP TYPE "public"."enum_subscriptions_location_filters_filter_type";`)
}
