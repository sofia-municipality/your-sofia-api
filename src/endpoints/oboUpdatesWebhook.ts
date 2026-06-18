/**
 * Inbound webhook that lets OboApp push update changes to us in real time,
 * instead of waiting for the periodic `syncOboUpdates` crawl. The change is
 * applied to the same `obo-updates` cache the crawl maintains, so both writers
 * stay consistent.
 *
 * ── Contract ────────────────────────────────────────────────────────────────
 *   POST /api/updates/webhook
 *   Header:  X-Api-Key: <OBO_WEBHOOK_API_KEY>
 *   Body (application/json), one of:
 *     { "event": "created" | "updated", "message": { <OBO message object> } }
 *     { "event": "deleted", "id": "<message id>" }
 *
 *   Responses:
 *     200 { status: "ok", event, id, result }   result: created | updated | deleted | missing
 *     400 invalid body
 *     401 missing/invalid API key
 *     500 storage failure
 *     503 webhook key not configured on our side
 *
 * Idempotent: "created" and "updated" both upsert by id, and deleting an
 * unknown id still returns 200 (result: "missing"), so OboApp can safely retry
 * on any 5xx.
 */
import { createHash, timingSafeEqual } from 'crypto'
import type { Endpoint } from 'payload'
import { docToUpdateMessage } from '@/lib/oboMessageMapper'
import { deleteOboUpdate, upsertOboUpdate } from '@/lib/oboUpdatesStore'

const API_KEY_HEADER = 'x-api-key'

/**
 * Constant-time string comparison. Both inputs are hashed to a fixed-length
 * digest first, so the comparison neither short-circuits on the first
 * differing byte nor leaks the key length via timing or a length mismatch.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

type WebhookBody = { event?: unknown; message?: unknown; id?: unknown }

function extractDeleteId(body: WebhookBody): string | null {
  if (typeof body.id === 'string' && body.id.trim()) return body.id.trim()
  const fromMessage = (body.message as { id?: unknown } | null | undefined)?.id
  if (typeof fromMessage === 'string' && fromMessage.trim()) return fromMessage.trim()
  return null
}

export const oboUpdatesWebhook: Endpoint = {
  path: '/updates/webhook',
  method: 'post',
  handler: async (req) => {
    // ── Auth (fail closed) ──────────────────────────────────────────────────
    const expectedKey = process.env.OBO_WEBHOOK_API_KEY
    if (!expectedKey) {
      req.payload?.logger?.error('[updatesWebhook] OBO_WEBHOOK_API_KEY not configured — rejecting')
      return Response.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const providedKey = req.headers?.get(API_KEY_HEADER)
    if (!providedKey || !timingSafeEqualStr(providedKey, expectedKey)) {
      req.payload?.logger?.warn('[updatesWebhook] Rejected request with missing/invalid API key')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    if (typeof req.json !== 'function') {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    let body: WebhookBody
    try {
      body = (await req.json()) as WebhookBody
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const event = typeof body.event === 'string' ? body.event.toLowerCase() : null
    if (event !== 'created' && event !== 'updated' && event !== 'deleted') {
      return Response.json(
        { error: 'event must be one of: created, updated, deleted' },
        { status: 400 }
      )
    }

    // ── Delete ──────────────────────────────────────────────────────────────
    if (event === 'deleted') {
      const id = extractDeleteId(body)
      if (!id) {
        return Response.json({ error: 'deleted event requires a string id' }, { status: 400 })
      }
      try {
        const removed = await deleteOboUpdate(req.payload, id)
        return Response.json({
          status: 'ok',
          event,
          id,
          result: removed > 0 ? 'deleted' : 'missing',
        })
      } catch (err) {
        req.payload?.logger?.error({ err }, '[updatesWebhook] Failed to delete update')
        return Response.json({ error: 'Failed to persist update' }, { status: 500 })
      }
    }

    // ── Create / update → upsert ────────────────────────────────────────────
    if (typeof body.message !== 'object' || body.message === null) {
      return Response.json({ error: `${event} event requires a message object` }, { status: 400 })
    }

    const message = docToUpdateMessage(body.message as Record<string, unknown>)
    if (!message || !message.id) {
      return Response.json(
        { error: 'message could not be parsed or is missing an id' },
        { status: 400 }
      )
    }

    try {
      const result = await upsertOboUpdate(req.payload, message)
      return Response.json({ status: 'ok', event, id: message.id, result })
    } catch (err) {
      req.payload?.logger?.error({ err }, '[updatesWebhook] Failed to upsert update')
      return Response.json({ error: 'Failed to persist update' }, { status: 500 })
    }
  },
}
