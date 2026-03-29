import { getPayload } from 'payload'
import config from '../payload.config'
import * as readline from 'readline'

// Manually queue and run the syncWasteCollectionSchedules task.
//
// Usage:
//   pnpm sync:schedules
//   (or directly: pnpm tsx --env-file=.env src/scripts/runScheduleSync.ts)
//
// Optional overrides (all default to full run for current month):
//   YEAR=2026 MONTH=2 pnpm sync:schedules
//   YEAR=2026 MONTH=2 DISTRICT=TRIADICA SIZE=1100 pnpm sync:schedules

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close()
      resolve(ans)
    })
  )
}

async function main() {
  const year = process.env.YEAR ? parseInt(process.env.YEAR, 10) : new Date().getFullYear()
  const month = process.env.MONTH ? parseInt(process.env.MONTH, 10) : new Date().getMonth() + 1
  const district = process.env.DISTRICT
  const size = process.env.SIZE

  const label = [
    `${year}-${String(month).padStart(2, '0')}`,
    district ?? 'all districts',
    size ? `size=${size}` : 'all sizes',
  ].join(' / ')
  console.log(`Syncing schedules for ${label}...`)

  const payload = await getPayload({ config })

  // Check for cached geocode misses and offer to retry them
  const misses = await payload.find({
    collection: 'geocode-addresses',
    where: { location: { exists: false } },
    limit: 0,
    overrideAccess: true,
  })
  if (misses.totalDocs > 0) {
    const ans = await ask(`${misses.totalDocs} cached geocode misses found. Retry them? [y/N] `)
    if (ans.trim().toLowerCase() === 'y') {
      await payload.delete({
        collection: 'geocode-addresses',
        where: { location: { exists: false } },
        overrideAccess: true,
      })
      console.log(`Cleared ${misses.totalDocs} null entries — they will be re-geocoded.`)
    }
  }

  console.log('Queuing task...')
  await payload.jobs.queue({
    task: 'syncWasteCollectionSchedules',
    input: { year, month, ...(district ? { district } : {}), ...(size ? { size } : {}) },
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
