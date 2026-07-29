import { getPayload } from 'payload'
import config from '@payload-config'
import path from 'path'
import { pathToFileURL } from 'url'

/**
 * Run a specific migration by filename
 * Usage:
 *   pnpm migrate:run <migration-filename> [up|down]
 *
 * Examples:
 *   pnpm migrate:run 20260209_174317_container_location
 *   pnpm migrate:run 20260209_174317_container_location up
 *   pnpm migrate:run 20260209_174317_container_location down
 */

async function runMigration() {
  const args = process.argv.slice(2)
  const migrationName = args[0]
  const direction = args[1] || 'up'

  if (!migrationName) {
    console.error('Error: Migration filename is required')
    console.log('Usage: pnpm migrate:run <migration-filename> [up|down]')
    console.log('Example: pnpm migrate:run 20260209_174317_container_location')
    process.exit(1)
  }

  if (direction !== 'up' && direction !== 'down') {
    console.error('Error: Direction must be either "up" or "down"')
    process.exit(1)
  }

  try {
    console.log(`Loading Payload...`)
    const payload = await getPayload({ config })

    console.log(`Payload loaded successfully!`)
    console.log(`Preparing to run migration: ${migrationName} (${direction})`)

    // Construct the migration file path
    const migrationFileName = migrationName.endsWith('.ts') ? migrationName : `${migrationName}.ts`
    console.log(`Looking for migration file: ${migrationFileName}`)

    const migrationPath = path.resolve(process.cwd(), 'src/migrations', migrationFileName)

    console.log(`Loading migration: ${migrationFileName}`)
    console.log(`Path: ${migrationPath}`)

    // Dynamically import the migration (file:// URL is required on Windows)
    const migration = await import(pathToFileURL(migrationPath).href)

    if (!migration[direction]) {
      console.error(`Error: Migration does not have a "${direction}" function`)
      process.exit(1)
    }

    // Get the database instance and wrap execute to use drizzle directly
    const db = payload.db

    // Create a proxy db object that uses drizzle directly for execute
    const dbProxy = new Proxy(db, {
      get(target, prop) {
        if (prop === 'execute') {
          // Return a function that uses drizzle's execute directly
          return async (query: any) => {
            return await target.drizzle.execute(query)
          }
        }
        return target[prop as keyof typeof target]
      },
    })

    // Prepare migration arguments matching MigrateUpArgs structure
    const migrationArgs = {
      db: dbProxy,
      payload,
      req: {
        payload,
        user: null,
        locale: undefined,
        fallbackLocale: undefined,
      },
    }

    console.log(`\nRunning migration ${direction}...`)
    console.log('─'.repeat(50))

    // Run the migration with proper context
    await migration[direction](migrationArgs)

    console.log('─'.repeat(50))
    console.log(`✅ Migration ${direction} completed successfully!`)

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:')
    console.error(error)
    process.exit(1)
  }
}

await runMigration()
