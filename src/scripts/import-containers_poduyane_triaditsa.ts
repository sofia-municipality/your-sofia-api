import { getPayload } from 'payload'
import config from '../payload.config'
import { down, up } from '../migrations/20260111_import_podyane_and_triaditsa_containers'

// Script to run the container import migration
// Usage: pnpm tsx --env-file=.env src/scripts/import-containers-podyane-triaditsa.ts

async function runImport() {
  try {
    console.log('Initializing Payload...')
    const payload = await getPayload({ config })

    console.log('Running container import migration...')
    await down({ payload } as any)
    await up({ payload } as any)

    console.log('Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runImport()
