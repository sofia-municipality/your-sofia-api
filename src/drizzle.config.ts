import { defineConfig } from 'drizzle-kit'
import { withPayload } from '@payloadcms/next/withPayload'

const drizzleConfig = defineConfig({
  dialect: 'postgresql',
  schema: './src/collections/**/*.ts',
  out: './src/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URI || '',
  },
  extensionsFilters: ['postgis'], // Ignore PostGIS system tables
  tablesFilter: [
    '!spatial_ref_sys',
    '!geography_columns',
    '!geometry_columns',
    '!raster_columns',
    '!raster_overviews',
  ],
})

export default withPayload(drizzleConfig, { devBundleServerPackages: false })
