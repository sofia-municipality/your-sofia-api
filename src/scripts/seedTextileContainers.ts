import config from '@payload-config'
import { getPayload } from 'payload'

import { seedTextileContainerRows } from '../utilities/seedTextileContainers'

async function main(): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const count = await payload.db.drizzle.transaction((tx) => seedTextileContainerRows(tx))
    payload.logger.info(`Seeded ${count} textile containers.`)
    process.exit(0)
  } catch (error) {
    console.error('Failed to seed textile containers:', error)
    process.exit(1)
  }
}

void main()
