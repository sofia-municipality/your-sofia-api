import { seedDrinkingFountainsFromEnv } from '../utilities/seedDrinkingFountains'

/**
 * Seed script for drinking fountains.
 * Run with: pnpm seed:drinking-fountains
 *
 * Uses a direct pg connection (no Payload boot) so it is unaffected by the
 * tsx/Node incompatibility that breaks `payload run` on newer Node versions.
 *
 * Requires the schema to already exist (dev push via `pnpm dev`, or the
 * migration) and city districts to be seeded (migration 20260311).
 */
async function seed() {
  try {
    console.log('🚀 Starting seed process...\n')
    await seedDrinkingFountainsFromEnv()
    console.log('\n🎉 Seed process completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Seed process failed:', error)
    process.exit(1)
  }
}

seed()
