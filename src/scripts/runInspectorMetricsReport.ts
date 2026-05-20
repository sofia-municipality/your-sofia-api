import { runInspectorMetricsReport } from '../tasks/Reports/sendInspectorMetricsReportHandler'

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

runReport()
