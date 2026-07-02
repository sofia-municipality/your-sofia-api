declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      // YSM OboApp MongoDB — read-only, shared with the YSM OboApp fork ingestion
      YSM_OBOAPP_MONGODB_URI: string
      YSM_OBOAPP_MONGODB_DATABASE?: string // default: 'oboapp'
      // Private key used by oboapp.online to fetch /api/updates-export
      YSM_OBOAPP_SYNC_API_KEY: string
      // Maximum combined messages count before /api/updates-export returns 413 (default: '100')
      YSM_OBOAPP_SYNC_LIMIT_MAX?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
