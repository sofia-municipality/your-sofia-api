import { getPayload } from 'payload'
import config from '../payload.config'
import { buildSyncWindow } from '../tasks/WasteCollection/processWasteCollectionEvents'

// Manually queue and run the processWasteCollectionEvents task.
//
// Usage:
//   pnpm tsx --env-file=.env src/scripts/runWasteCollectionSync.ts
//
// Optional custom window (UTC, format "YYYY-MM-DD HH:MM"):
//   pnpm tsx --env-file=.env src/scripts/runWasteCollectionSync.ts \
//     --from "2026-03-03 08:00" --to "2026-03-03 20:00"

function parseArgs(): { from: string; to: string } {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] : undefined
  }
  const from = get('--from')
  const to = get('--to')
  if ((from && !to) || (!from && to)) {
    console.error('Error: --from and --to must both be provided, or neither.')
    process.exit(1)
  }
  return from && to ? { from, to } : buildSyncWindow(1)
}

async function main() {
  const window = parseArgs()
  console.log(`Sync window: ${window.from} → ${window.to}`)

  const payload = await getPayload({ config })

  console.log('Queuing task...')
  await payload.jobs.queue({
    task: 'processWasteCollectionEvents',
    input: window,
  })

  console.log('Running queued jobs...')
  const result = await payload.jobs.run()
  console.log('Done.', result)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
