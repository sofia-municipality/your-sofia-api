import * as Sentry from '@sentry/nextjs'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

const isDev = process.env.NODE_ENV === 'development'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: isDev ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    nodeProfilingIntegration(),
  ],
  profileSessionSampleRate: isDev ? 1.0 : 0.1,
  profileLifecycle: 'trace',
})
