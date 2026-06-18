import type { BasePayload, TaskConfig, TaskHandler } from 'payload'
import { fetchActiveUpdates, isOboRestConfigured } from '@/lib/oboUpdatesSource'
import type { UpdateMessage } from '@/lib/oboMessageMapper'
import { buildOboUpdateRow } from '@/lib/oboUpdatesStore'

const TASK_SLUG = 'syncOboUpdates'

export interface SyncOboUpdatesOutput {
  fetched: number
  upserted: number
  pruned: number
  skipped: number
}

/**
 * Pull the current active updates from the OboApp REST API and reconcile them
 * into the `obo-updates` table:
 *   - upsert every fetched message (keyed by `oboId`)
 *   - prune rows that were not in this fetch (messages OboApp removed)
 *
 * Safety: if the upstream fetch fails the cache is left completely untouched
 * (we never wipe on a transient error). Pruning is also skipped when the fetch
 * returns zero messages, to avoid emptying the table on a degraded-but-200
 * upstream response.
 */
export async function runSyncOboUpdates(payload: BasePayload): Promise<SyncOboUpdatesOutput> {
  if (!isOboRestConfigured()) {
    payload.logger.error(`[${TASK_SLUG}] OBOAPP_UPDATES_BASE_URL/OBOAPP_API_KEY not set — skipping`)
    return { fetched: 0, upserted: 0, pruned: 0, skipped: 0 }
  }

  let messages: UpdateMessage[]
  try {
    messages = await fetchActiveUpdates()
  } catch (err) {
    payload.logger.error(`[${TASK_SLUG}] Failed to fetch updates — leaving cache untouched: ${err}`)
    return { fetched: 0, upserted: 0, pruned: 0, skipped: 0 }
  }

  payload.logger.info(`[${TASK_SLUG}] Fetched ${messages.length} update(s) from upstream`)

  // Index existing rows by oboId so we can decide create-vs-update and prune.
  const existing = await payload.find({
    collection: 'obo-updates',
    pagination: false,
    depth: 0,
    select: { oboId: true },
    overrideAccess: true,
  })
  const existingIdByOboId = new Map<string, number | string>()
  for (const doc of existing.docs) {
    existingIdByOboId.set(doc.oboId, doc.id)
  }

  let upserted = 0
  let skipped = 0
  const seen = new Set<string>()

  for (const msg of messages) {
    // Without a stable id we can neither dedupe on upsert nor serve via by-id.
    if (!msg.id) {
      skipped++
      continue
    }
    seen.add(msg.id)

    const data = buildOboUpdateRow(msg)

    try {
      const existingId = existingIdByOboId.get(msg.id)
      if (existingId !== undefined) {
        await payload.update({
          collection: 'obo-updates',
          id: existingId,
          data,
          overrideAccess: true,
        })
      } else {
        await payload.create({ collection: 'obo-updates', data, overrideAccess: true })
      }
      upserted++
    } catch (err) {
      payload.logger.error(`[${TASK_SLUG}] Failed to upsert update ${msg.id}: ${err}`)
      skipped++
    }
  }

  // Prune messages that disappeared upstream — but never when the fetch was empty.
  let pruned = 0
  if (messages.length > 0) {
    const staleIds: (number | string)[] = []
    for (const [oboId, id] of existingIdByOboId) {
      if (!seen.has(oboId)) staleIds.push(id)
    }
    if (staleIds.length > 0) {
      try {
        await payload.delete({
          collection: 'obo-updates',
          where: { id: { in: staleIds } },
          overrideAccess: true,
        })
        pruned = staleIds.length
      } catch (err) {
        payload.logger.error(
          `[${TASK_SLUG}] Failed to prune ${staleIds.length} stale update(s): ${err}`
        )
      }
    }
  }

  payload.logger.info(
    `[${TASK_SLUG}] Done — fetched=${messages.length} upserted=${upserted} pruned=${pruned} skipped=${skipped}`
  )
  return { fetched: messages.length, upserted, pruned, skipped }
}

const handler: TaskHandler<'syncOboUpdates'> = async ({ req }) => {
  const output = await runSyncOboUpdates(req.payload)
  return { output }
}

export const syncOboUpdates: TaskConfig<'syncOboUpdates'> = {
  slug: TASK_SLUG,
  label: 'Sync OboApp updates from the REST API into Postgres',
  retries: 1,
  outputSchema: [
    { name: 'fetched', type: 'number', required: true },
    { name: 'upserted', type: 'number', required: true },
    { name: 'pruned', type: 'number', required: true },
    { name: 'skipped', type: 'number', required: true },
  ],
  schedule: [{ cron: '*/15 * * * *', queue: 'default' }], // Every 15 minutes
  handler,
}
