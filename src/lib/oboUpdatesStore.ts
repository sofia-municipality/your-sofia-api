/**
 * Persistence helpers for the `obo-updates` cache table.
 *
 * Both writers — the scheduled `syncOboUpdates` task (bulk reconcile) and the
 * inbound `/api/updates/webhook` endpoint (single events pushed by OboApp) —
 * go through here, so the row shape (locality default, date coercion, verbatim
 * JSONB body) is defined in exactly one place.
 */
import type { BasePayload } from 'payload'
import { SOFIA_LOCALITY, type UpdateMessage } from './oboMessageMapper'

const COLLECTION = 'obo-updates'

export interface OboUpdateRow {
  oboId: string
  locality: string
  timespanEnd: string | null
  finalizedAt: string | null
  data: Record<string, unknown>
}

function toDateOrNull(value: string | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Map a public UpdateMessage to its `obo-updates` row. The caller must ensure
 * `message.id` is set — it is the unique key (`oboId`).
 */
export function buildOboUpdateRow(message: UpdateMessage): OboUpdateRow {
  return {
    oboId: message.id as string,
    // The feed is Sofia-scoped; default a missing/blank locality so the
    // locality-filtered read paths never silently drop the message. Real
    // values (incl. other localities) are preserved as-is.
    locality: message.locality?.trim() || SOFIA_LOCALITY,
    timespanEnd: toDateOrNull(message.timespanEnd),
    finalizedAt: toDateOrNull(message.finalizedAt),
    // The public message is stored verbatim in the JSONB `data` column.
    data: message as unknown as Record<string, unknown>,
  }
}

/**
 * Create or update the cached row for a message, keyed by `oboId`.
 * Returns whether the row was created or updated.
 */
export async function upsertOboUpdate(
  payload: BasePayload,
  message: UpdateMessage
): Promise<'created' | 'updated'> {
  const data = buildOboUpdateRow(message)

  const existing = await payload.find({
    collection: COLLECTION,
    where: { oboId: { equals: data.oboId } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  const existingId = existing.docs[0]?.id
  if (existingId !== undefined) {
    await payload.update({ collection: COLLECTION, id: existingId, data, overrideAccess: true })
    return 'updated'
  }

  await payload.create({ collection: COLLECTION, data, overrideAccess: true })
  return 'created'
}

/**
 * Delete the cached row(s) for an `oboId`. Returns the number of rows removed
 * (0 when nothing matched — deletion is idempotent).
 */
export async function deleteOboUpdate(payload: BasePayload, oboId: string): Promise<number> {
  const res = await payload.delete({
    collection: COLLECTION,
    where: { oboId: { equals: oboId } },
    overrideAccess: true,
  })
  return res.docs?.length ?? 0
}
