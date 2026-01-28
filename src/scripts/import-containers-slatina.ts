import { getPayload } from 'payload'
import config from '../payload.config'
import { down, up } from '../migrations/20260128_import_slatina_containers'

// Usage: pnpm tsx --env-file=.env src/scripts/import-containers-slatina.ts

async function runImport() {
  try {
    console.log('Initializing Payload...')
    const payload = await getPayload({ config })

    console.log('Running kofi.slatina import migration...')
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
