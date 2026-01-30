import { getPayload } from 'payload'
import config from '../payload.config'
import * as migration from '../migrations/20251025_import_votes'

// Script to run the votes import migration
// Usage: pnpm tsx --env-file=.env src/scripts/import-votes.ts

async function importVotes() {
  console.log('Initializing Payload...')

  const payload = await getPayload({ config })

  console.log('Running votes import migration...')

  try {
    await migration.down({ payload } as any)
    await migration.up({ payload } as any)
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

importVotes()
