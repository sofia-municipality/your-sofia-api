import type { Endpoint } from 'payload'

export const healthCheck: Endpoint = {
  path: '/health',
  method: 'get',
  handler: async (req) => {
    try {
      // Basic health check - API is responding
      return Response.json(
        {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
        { status: 200 }
      )
    } catch (error) {
      return Response.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 503 }
      )
    }
  },
}
