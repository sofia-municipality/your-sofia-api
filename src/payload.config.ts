// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { migrations } from './migrations'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { en } from '@payloadcms/translations/languages/en'
import { bg } from '@payloadcms/translations/languages/bg'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { News } from './collections/News'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { PushTokens } from './collections/PushTokens'
import { CityDistricts } from './collections/CityDistricts'
import { WasteContainers } from './collections/WasteContainers'
import { WasteContainerObservations } from './collections/WasteContainerObservations'
import { WasteCollectionZones } from './collections/WasteCollectionZones'
import { Signals } from './collections/Signals/index'
import { Assignments } from './collections/Assignments'
import { GeocodeAddresses } from './collections/GeocodeAddresses'
import { Subscriptions } from './collections/Subscriptions'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { NotificationSettings } from './globals/NotificationSettings'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { healthCheck } from './endpoints/health'
import { updates } from './endpoints/updates'
import { updatesById } from './endpoints/updatesById'
import { updatesOpenApi } from './endpoints/updatesOpenApi'
import { updatesSources } from './endpoints/updatesSources'
import {
  signalsAgeMetric,
  signalsStatusMetric,
  signalsActiveContainerStateMetric,
} from './endpoints/signals-metrics'
import { processWasteCollectionEvents } from './tasks/WasteCollection/processWasteCollectionEvents'
import { sendUpdatesNotifications } from './tasks/Notifications/sendUpdatesNotifications'
import { sendInspectorMetricsReport } from './tasks/Reports/sendInspectorMetricsReport'
import { adminOnly } from '@/access/adminOnly'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const serverURL = getServerSideURL()

const defaultFromName = process.env.EMAIL_FROM_NAME || 'Твоята София'
const defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || 'no-reply@your.sofia.bg'
const parsedSmtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10)
const smtpPort = Number.isNaN(parsedSmtpPort) ? 587 : parsedSmtpPort
const smtpSecure = process.env.SMTP_SECURE === 'true'

const email = nodemailerAdapter(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        defaultFromName,
        defaultFromAddress,
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: process.env.SMTP_FORBID_SELF_SIGNED === 'true',
          },
        },
      }
    : {
        defaultFromName,
        defaultFromAddress,
      }
)

export default buildConfig({
  admin: {
    components: {
      graphics: {
        Icon: '@/components/AdminBrand/AdminGraphics',
        Logo: '@/components/AdminBrand/AdminGraphics',
      },
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      beforeDashboard: ['@/components/BeforeDashboard'],
      beforeNavLinks: [
        '@/components/MetricsDashboard/NavLink',
        '@/components/WasteContainerMap/NavLink',
      ],
      views: {
        metricsView: {
          Component: '@/components/MetricsDashboard/index',
          path: '/metrics',
        },
        wasteMapView: {
          Component: '@/components/WasteContainerMap/index',
          path: '/waste-map',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: process.env.NODE_ENV === 'development', // Enable push only in development environment
    extensions: ['postgis'], // Enable PostGIS extension
    tablesFilter: [
      '!spatial_ref_sys',
      '!geography_columns',
      '!geometry_columns',
      '!raster_columns',
      '!raster_overviews',
    ], // Ignore PostGIS system tables
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  collections: [
    News,
    Pages,
    Posts,
    Media,
    Categories,
    Users,
    PushTokens,
    CityDistricts,
    WasteContainers,
    WasteContainerObservations,
    WasteCollectionZones,
    Signals,
    Assignments,
    GeocodeAddresses,
    Subscriptions,
  ],
  cors: [serverURL].filter(Boolean),
  email,
  endpoints: [
    healthCheck,
    updates,
    updatesById,
    updatesSources,
    updatesOpenApi,
    signalsAgeMetric,
    signalsStatusMetric,
    signalsActiveContainerStateMetric,
  ],
  globals: [Header, Footer, NotificationSettings],
  i18n: {
    supportedLanguages: { en, bg },
    fallbackLanguage: 'bg',
    translations: {
      bg: {
        authentication: {
          login: 'Влез',
        },
        'plugin-redirects': {
          customUrl: 'Собствен URL',
          documentToRedirect: 'Документ за пренасочване',
          fromUrl: 'От URL',
          internalLink: 'Вътрешна връзка',
          redirectType: 'Тип пренасочване',
          toUrlType: 'Тип на целевия URL',
        },
      },
    },
  },
  localization: {
    locales: [
      {
        label: 'Bulgarian',
        code: 'bg',
      },
      {
        label: 'English',
        code: 'en',
      },
    ],
    defaultLocale: 'bg',
    fallback: true,
  },
  plugins: [
    ...plugins,
    // storage-adapter-placeholder
  ],
  serverURL,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Only allow users with 'admin' role
        if (req.user && req.user.role === 'admin') return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [processWasteCollectionEvents, sendUpdatesNotifications, sendInspectorMetricsReport],
    autoRun: [
      {
        cron: '*/2 * * * *', // Check every 2 minutes
        queue: 'default', // Process 'default' queue (for manually queued jobs)
        limit: 10,
      },
    ],
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {}
      }

      defaultJobsCollection.admin.hidden = adminOnly
      return defaultJobsCollection
    },
  },
})
