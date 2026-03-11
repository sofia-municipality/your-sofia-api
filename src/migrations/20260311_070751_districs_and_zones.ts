import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

const ZONES = [
  { number: 1, name: 'Зона 1' },
  { number: 2, name: 'Зона 2' },
  { number: 3, name: 'Зона 3' },
  { number: 4, name: 'Зона 4' },
  { number: 5, name: 'Зона 5' },
  { number: 6, name: 'Зона 6' },
  { number: 7, name: 'Зона 7' },
  { number: 8, name: 'Зона 8' },
  { number: 9, name: 'Зона 9' },
  { number: 10, name: 'Зона 10' },
]

const DISTRICTS: { districtId: number; name: string; code: string; zoneNumber: number }[] = [
  { districtId: 1,  name: 'Банкя',          code: 'RBA', zoneNumber: 10 },
  { districtId: 2,  name: 'Витоша',         code: 'RVI', zoneNumber: 8  },
  { districtId: 3,  name: 'Връбница',       code: 'RVR', zoneNumber: 7  },
  { districtId: 4,  name: 'Възраждане',     code: 'RVA', zoneNumber: 5  },
  { districtId: 5,  name: 'Изгрев',         code: 'RIZ', zoneNumber: 3  },
  { districtId: 6,  name: 'Илинден',        code: 'RIL', zoneNumber: 7  },
  { districtId: 7,  name: 'Искър',          code: 'RIS', zoneNumber: 2  },
  { districtId: 8,  name: 'Красна поляна',  code: 'RKP', zoneNumber: 9  },
  { districtId: 9,  name: 'Красно село',    code: 'RKS', zoneNumber: 10 },
  { districtId: 10, name: 'Кремиковци',     code: 'RKR', zoneNumber: 4  },
  { districtId: 11, name: 'Лозенец',        code: 'RLO', zoneNumber: 1  },
  { districtId: 12, name: 'Люлин',          code: 'RLY', zoneNumber: 6  },
  { districtId: 13, name: 'Младост',        code: 'RML', zoneNumber: 9  },
  { districtId: 14, name: 'Надежда',        code: 'RNA', zoneNumber: 7  },
  { districtId: 15, name: 'Нови Искър',     code: 'RNI', zoneNumber: 4  },
  { districtId: 16, name: 'Овча купел',     code: 'ROK', zoneNumber: 6  },
  { districtId: 17, name: 'Оборище',        code: 'ROB', zoneNumber: 5  },
  { districtId: 18, name: 'Панчарево',      code: 'RPA', zoneNumber: 2  },
  { districtId: 19, name: 'Подуяне',        code: 'RPO', zoneNumber: 3  },
  { districtId: 20, name: 'Сердика',        code: 'RSE', zoneNumber: 5  },
  { districtId: 21, name: 'Слатина',        code: 'RSL', zoneNumber: 3  },
  { districtId: 22, name: 'Студентски',     code: 'RST', zoneNumber: 1  },
  { districtId: 23, name: 'Средец',         code: 'RSR', zoneNumber: 1  },
  { districtId: 24, name: 'Триадица',       code: 'RTR', zoneNumber: 8  },
]

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ── Schema ────────────────────────────────────────────────────────────────
  await db.execute(sql`
   CREATE TABLE "city_districts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"district_id" numeric NOT NULL,
  	"name" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"waste_collection_zone_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "waste_collection_zones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric NOT NULL,
  	"name" varchar NOT NULL,
  	"service_company_id" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "waste_containers" ADD COLUMN "district_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "city_districts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "waste_collection_zones_id" integer;
  ALTER TABLE "city_districts" ADD CONSTRAINT "city_districts_waste_collection_zone_id_waste_collection_zones_id_fk" FOREIGN KEY ("waste_collection_zone_id") REFERENCES "public"."waste_collection_zones"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "city_districts_district_id_idx" ON "city_districts" USING btree ("district_id");
  CREATE UNIQUE INDEX "city_districts_code_idx" ON "city_districts" USING btree ("code");
  CREATE INDEX "city_districts_waste_collection_zone_idx" ON "city_districts" USING btree ("waste_collection_zone_id");
  CREATE INDEX "city_districts_updated_at_idx" ON "city_districts" USING btree ("updated_at");
  CREATE INDEX "city_districts_created_at_idx" ON "city_districts" USING btree ("created_at");
  CREATE UNIQUE INDEX "waste_collection_zones_number_idx" ON "waste_collection_zones" USING btree ("number");
  CREATE INDEX "waste_collection_zones_updated_at_idx" ON "waste_collection_zones" USING btree ("updated_at");
  CREATE INDEX "waste_collection_zones_created_at_idx" ON "waste_collection_zones" USING btree ("created_at");
  ALTER TABLE "waste_containers" ADD CONSTRAINT "waste_containers_district_id_city_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."city_districts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_city_districts_fk" FOREIGN KEY ("city_districts_id") REFERENCES "public"."city_districts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waste_collection_zones_fk" FOREIGN KEY ("waste_collection_zones_id") REFERENCES "public"."waste_collection_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "waste_containers_district_idx" ON "waste_containers" USING btree ("district_id");
  CREATE INDEX "payload_locked_documents_rels_city_districts_id_idx" ON "payload_locked_documents_rels" USING btree ("city_districts_id");
  CREATE INDEX "payload_locked_documents_rels_waste_collection_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("waste_collection_zones_id");`)

  // ── Seed zones ────────────────────────────────────────────────────────────
  const zoneIdByNumber = new Map<number, number>()
  for (const zone of ZONES) {
    const created = await payload.create({
      collection: 'waste-collection-zones',
      data: zone as any,
      overrideAccess: true,
      req,
    })
    zoneIdByNumber.set(zone.number, created.id as number)
  }

  // ── Seed city districts ───────────────────────────────────────────────────
  for (const district of DISTRICTS) {
    await payload.create({
      collection: 'city-districts',
      data: {
        districtId: district.districtId,
        name: district.name,
        code: district.code,
        wasteCollectionZone: zoneIdByNumber.get(district.zoneNumber),
      } as any,
      overrideAccess: true,
      req,
    })
  }

  // ── Backfill waste-containers district_id ────────────────────────────────
  await db.execute(sql`
    UPDATE waste_containers
    SET    district_id = cd.id
    FROM   city_districts cd
    WHERE  LEFT(waste_containers.public_number, 3) = cd.code
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "city_districts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "waste_collection_zones" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "city_districts" CASCADE;
  DROP TABLE "waste_collection_zones" CASCADE;
  ALTER TABLE "waste_containers" DROP CONSTRAINT IF EXISTS "waste_containers_district_id_city_districts_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_city_districts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_waste_collection_zones_fk";
  
  DROP INDEX IF EXISTS "waste_containers_district_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_city_districts_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_waste_collection_zones_id_idx";
  ALTER TABLE "waste_containers" DROP COLUMN "district_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "city_districts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "waste_collection_zones_id";`)
}
