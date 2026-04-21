import type { TaskConfig, TaskHandler } from 'payload'
import { buildUpdatesUpstreamUrl } from '@/endpoints/updatesProxyUtils'
import { matchSubscriptions } from '@/utilities/matchSubscriptions'
import { sendPushNotifications, sendPushNotificationsToTokens } from '@/utilities/pushNotifications'

interface UpdateMessage {
  id?: string
  text: string
  plainText?: string
  createdAt: string
  categories?: string[]
}

const TASK_SLUG = 'sendUpdatesNotifications'

const handler: TaskHandler<'sendUpdatesNotifications'> = async ({ req }) => {
  const { payload } = req

  // ── 1. Determine look-back window ─────────────────────────────────────────
  const settings = await payload.findGlobal({
    slug: 'notification-settings',
    overrideAccess: true,
  })

  const since = settings.lastUpdatesNotifiedAt
    ? new Date(settings.lastUpdatesNotifiedAt as string)
    : new Date(Date.now() - 15 * 60 * 1000)

  payload.logger.info(`[${TASK_SLUG}] Checking for updates newer than ${since.toISOString()}`)

  // ── 2. Fetch current active updates from upstream ─────────────────────────
  const targetUrl = buildUpdatesUpstreamUrl('/messages', {})
  if (!targetUrl) {
    payload.logger.error(`[${TASK_SLUG}] OBOAPP_UPDATES_BASE_URL is not configured — skipping`)
    return { output: { notified: 0 } }
  }

  const apiKey = process.env.OBOAPP_API_KEY
  if (!apiKey) {
    payload.logger.error(`[${TASK_SLUG}] OBOAPP_API_KEY is not configured — skipping`)
    return { output: { notified: 0 } }
  }

  let messages: UpdateMessage[] = []
  try {
    const res = await fetch(targetUrl.toString(), {
      headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      payload.logger.error(`[${TASK_SLUG}] Upstream returned ${res.status} — skipping`)
      return { output: { notified: 0 } }
    }
    const body = await res.json()
    messages = (body.messages ?? []) as UpdateMessage[]
  } catch (err) {
    payload.logger.error(`[${TASK_SLUG}] Failed to fetch upstream updates: ${err}`)
    return { output: { notified: 0 } }
  }

  // ── 3. Filter to new messages only ────────────────────────────────────────
  const newMessages = messages.filter((msg) => {
    if (!msg.createdAt) return false
    try {
      return new Date(msg.createdAt) > since
    } catch {
      return false
    }
  })

  payload.logger.info(`[${TASK_SLUG}] ${newMessages.length} new update(s) to notify about`)

  // ── 4. Update global timestamp before sending to avoid double-runs on error ─
  await payload.updateGlobal({
    slug: 'notification-settings',
    data: { lastUpdatesNotifiedAt: new Date().toISOString() },
    overrideAccess: true,
  })

  if (newMessages.length === 0) {
    return { output: { notified: 0 } }
  }

  // ── 5. Send notifications ─────────────────────────────────────────────────
  let notified = 0

  for (const msg of newMessages) {
    const title = 'Ново известие в Твоята София'
    const body = (msg.plainText ?? msg.text).slice(0, 150).trim()
    const data = { type: 'update', updateId: msg.id ?? '' }

    try {
      if (!Array.isArray(msg.categories) || msg.categories.length === 0) {
        // No category filter — broadcast to all active subscribers
        await sendPushNotifications(payload, { title, body, data })
        notified++
        continue
      }

      // Look up Payload Category docs by slug to get their IDs
      const catDocs = await payload.find({
        collection: 'categories',
        where: { slug: { in: msg.categories } },
        limit: 50,
        overrideAccess: true,
      })

      if (catDocs.docs.length === 0) {
        // Unrecognised categories — broadcast
        await sendPushNotifications(payload, { title, body, data })
        notified++
        continue
      }

      const tokenStrings = await matchSubscriptions(payload, {
        id: msg.id ?? 'update',
        categories: catDocs.docs.map((d) => ({ id: d.id })),
        district: null,
        location: null,
      })

      if (tokenStrings.length > 0) {
        await sendPushNotificationsToTokens(payload, tokenStrings, { title, body, data })
        notified++
      }
    } catch (err) {
      payload.logger.error(
        `[${TASK_SLUG}] Failed to send notification for update ${msg.id}: ${err}`
      )
    }
  }

  payload.logger.info(`[${TASK_SLUG}] Done — notified for ${notified} update(s)`)
  return { output: { notified } }
}

export const sendUpdatesNotifications: TaskConfig<'sendUpdatesNotifications'> = {
  slug: 'sendUpdatesNotifications',
  label: 'Send push notifications for new city updates',
  retries: 0,
  outputSchema: [{ name: 'notified', type: 'number', required: true }],
  schedule: [{ cron: '*/15 * * * *' }],
  handler,
}
