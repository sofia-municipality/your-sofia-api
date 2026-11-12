import { runInspectorMetricsReport } from '../tasks/Reports/sendInspectorMetricsReportHandler'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- call is suspended below
async function runReport() {
  try {
    console.log('🚀 Running inspector metrics report...')

    await runInspectorMetricsReport()

    console.log('✅ Inspector metrics report completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Inspector metrics report failed:', error)
    process.exit(1)
  }
}

// Undo this comment to resume daily report emails to inspectors and admins
// runReport()
