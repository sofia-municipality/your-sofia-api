import type { TaskConfig } from 'payload'
import { handler } from './sendInspectorMetricsReportHandler'

export const sendInspectorMetricsReport: TaskConfig<'sendInspectorMetricsReport'> = {
  slug: 'sendInspectorMetricsReport',
  label: 'Send inspector metrics report emails',
  retries: 1,
  outputSchema: [
    { name: 'recipients', type: 'number', required: true },
    { name: 'sent', type: 'number', required: true },
  ],
  schedule: [{ cron: '0 7 * * *', queue: 'default' }],
  handler,
}
