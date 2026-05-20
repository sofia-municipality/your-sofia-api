import type { BasePayload, TaskHandler } from 'payload'
import { getPayload } from 'payload'
import { buildHtmlReport } from './sendInspectorMetricsReportHtml'
import { loadInspectorMetricsReportData } from './sendInspectorMetricsReportData'

async function sendInspectorMetricsReport(payload: BasePayload) {
  const now = new Date()

  const userResult = await payload.find({
    collection: 'users',
    where: {
      role: {
        in: ['inspector', 'admin'],
      },
    },
    limit: 200,
    overrideAccess: true,
  })

  const recipients = Array.from(
    new Set(
      userResult.docs
        .map((user) => (typeof user.email === 'string' ? user.email.trim() : ''))
        .filter(Boolean)
    )
  )

  if (recipients.length === 0) {
    payload.logger.info('[sendInspectorMetricsReport] No inspectors found — skipping email')
    return { output: { recipients: 0, sent: 0 } }
  }

  const { summary, collectionTrend } = await loadInspectorMetricsReportData(payload, now)

  const serverUrl =
    payload.config.serverURL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    ''
  const adminPath = payload.config.routes?.admin ?? '/admin'
  const normalizedHost = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
  const baseAdminUrl = `${normalizedHost}${adminPath.startsWith('/') ? '' : '/'}${adminPath}`
  const metricsUrl = `${baseAdminUrl.replace(/\/$/, '')}/metrics`
  const mapUrl = `${baseAdminUrl.replace(/\/$/, '')}/waste-map`

  const includeWeekly = now.getDay() === 1
  const includeMonthly = now.getDate() === 1
  const generatedAt = now.toLocaleString('bg-BG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const html = buildHtmlReport(
    summary,
    collectionTrend,
    metricsUrl,
    mapUrl,
    includeWeekly,
    includeMonthly,
    generatedAt
  )

  const subject = `Доклад: контейнери и сигнали — ${generatedAt}`

  let sent = 0
  for (const recipient of recipients) {
    try {
      await payload.email.sendEmail({
        from: `"${payload.email.defaultFromName}" <${payload.email.defaultFromAddress}>`,
        to: recipient,
        subject,
        html,
      })
      sent++
    } catch (error) {
      payload.logger.error(
        `[sendInspectorMetricsReport] Failed to send report to ${recipient}: ${String(error)}`
      )
    }
  }

  return {
    output: {
      recipients: recipients.length,
      sent,
    },
  }
}

export const handler: TaskHandler<'sendInspectorMetricsReport'> = async ({ req }) => {
  return sendInspectorMetricsReport(req.payload)
}

export async function runInspectorMetricsReport() {
  const configModule = await import('../../payload.config')
  const config = configModule.default ?? configModule

  const payload = await getPayload({ config })
  return sendInspectorMetricsReport(payload)
}
