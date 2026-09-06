import * as Sentry from '@sentry/nextjs'

const isDevOrStaging =
  process.env.NODE_ENV === 'development' || (process.env.NODE_ENV as unknown) === 'staging'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: isDevOrStaging ? 1.0 : 0.1,
  enableLogs: true,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: isDevOrStaging ? 1.0 : 0.1,
  profileSessionSampleRate: isDevOrStaging ? 1.0 : 0.1,
  profileLifecycle: 'trace',
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    ...(isDevOrStaging
      ? [
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
            maskAllInputs: false,
          }),
        ]
      : []),
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration(),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
