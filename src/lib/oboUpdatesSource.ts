/**
 * Single integration point with the OboApp REST API.
 *
 * The `syncOboUpdates` task calls `fetchActiveUpdates()` to pull the current
 * set of city messages from `${OBOAPP_UPDATES_BASE_URL}/messages` and maps them
 * into the public `UpdateMessage` shape using the shared mapper. Everything
 * downstream (storage, filtering, serving) works off that normalized shape, so
 * this is the only place that knows the upstream wire format.
 */
import { buildUpdatesUpstreamUrl } from '@/endpoints/updatesProxyUtils'
import { docToUpdateMessage, type UpdateMessage } from './oboMessageMapper'

const FETCH_TIMEOUT_MS = 20_000

export function isOboRestConfigured(): boolean {
  return Boolean(process.env.OBOAPP_UPDATES_BASE_URL && process.env.OBOAPP_API_KEY)
}

/**
 * Fetch the full active message set from the OboApp REST API and normalize it.
 *
 * Throws on any failure (missing config, network/timeout, non-2xx, malformed
 * body) so the caller can decide to leave the existing cache untouched rather
 * than wiping it on a transient error. Individual documents that fail to map
 * are dropped (not fatal).
 */
export async function fetchActiveUpdates(): Promise<UpdateMessage[]> {
  const apiKey = process.env.OBOAPP_API_KEY
  if (!process.env.OBOAPP_UPDATES_BASE_URL) {
    throw new Error('OBOAPP_UPDATES_BASE_URL is not configured')
  }
  if (!apiKey) {
    throw new Error('OBOAPP_API_KEY is not configured')
  }

  const url = buildUpdatesUpstreamUrl('/messages')
  if (!url) {
    throw new Error('OBOAPP_UPDATES_BASE_URL is invalid')
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`OboApp upstream returned ${response.status}`)
  }

  const body = (await response.json().catch(() => null)) as { messages?: unknown } | null
  if (!body || !Array.isArray(body.messages)) {
    throw new Error('OboApp upstream response is missing a messages array')
  }

  return body.messages
    .map((raw) => docToUpdateMessage(raw as Record<string, unknown>))
    .filter((msg): msg is UpdateMessage => msg !== null)
}
