import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // added due to failures in Payload's codebase
    ignoreDuringBuilds: true,
  },
  typescript: {
    // added due to failures in Payload's codebase
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  reactStrictMode: true,
  redirects,
  output: 'standalone', // Enable for Docker deployment
  webpack: (config) => {
    // Replace chunkhash with contenthash for consistent hashing
    // https://www.reddit.com/r/nextjs/comments/1o4a0fv/deploying_payload_cms_3x_with_docker_compose/
    config.output.filename = config.output.filename.replace('[chunkhash]', '[contenthash]')
    config.output.chunkFilename = config.output.chunkFilename.replace(
      '[chunkhash]',
      '[contenthash]'
    )
    return config
  },
}
export default withPayload(nextConfig, { devBundleServerPackages: false })
