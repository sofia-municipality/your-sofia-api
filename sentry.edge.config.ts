import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV === 'development'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: isDev ? 1.0 : 0.1,
  enableLogs: true,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],
})
