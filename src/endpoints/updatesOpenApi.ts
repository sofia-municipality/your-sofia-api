import type { Endpoint } from 'payload'

const listParameters = [
  {
    name: 'north',
    in: 'query',
    schema: { type: 'number' },
  },
  {
    name: 'south',
    in: 'query',
    schema: { type: 'number' },
  },
  {
    name: 'east',
    in: 'query',
    schema: { type: 'number' },
  },
  {
    name: 'west',
    in: 'query',
    schema: { type: 'number' },
  },
  {
    name: 'zoom',
    in: 'query',
    schema: { type: 'number' },
  },
  {
    name: 'categories',
    in: 'query',
    schema: { type: 'string' },
    description: 'Comma-separated category ids',
  },
  {
    name: 'timespanEndGte',
    in: 'query',
    schema: { type: 'string', format: 'date-time' },
    description:
      'ISO timestamp lower bound for message timespan end. Defaults to today start when omitted.',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 0, maximum: 500 },
    description: 'Page size. Defaults to 200 and is capped at 500.',
  },
  {
    name: 'offset',
    in: 'query',
    schema: { type: 'integer', minimum: 0 },
    description: 'Pagination offset. Defaults to 0.',
  },
]

export const updatesOpenApi: Endpoint = {
  path: '/updates/openapi',
  method: 'get',
  handler: async () => {
    return Response.json({
      openapi: '3.1.0',
      info: {
        title: 'Your Sofia API - Updates',
        version: '2.0.0',
      },
      paths: {
        '/api/updates': {
          get: {
            summary: 'List updates',
            parameters: listParameters,
            responses: {
              '200': {
                description: 'List of public update messages',
              },
              '400': {
                description: 'Invalid query parameter',
              },
              '500': {
                description: 'Server error',
              },
            },
          },
        },
        '/api/updates/by-id': {
          get: {
            summary: 'Fetch a single update by id',
            parameters: [
              {
                name: 'id',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Single update message',
              },
              '400': {
                description: 'Missing or empty id parameter',
              },
              '404': {
                description: 'Message not found',
              },
              '500': {
                description: 'Server error',
              },
            },
          },
        },
        '/api/updates/sources': {
          get: {
            summary: 'List update sources (deprecated — legacy proxy)',
            deprecated: true,
            description:
              'Proxies to the upstream OboApp API. Retained for backwards compatibility with older mobile app versions. Requires OBOAPP_UPDATES_BASE_URL and OBOAPP_API_KEY to be configured.',
            responses: {
              '200': {
                description: 'List of sources from the upstream OboApp API',
              },
              '401': {
                description: 'Upstream unauthorized response (passed through)',
              },
              '403': {
                description: 'Upstream forbidden response (passed through)',
              },
              '404': {
                description: 'Upstream not found response (passed through)',
              },
              '502': {
                description: 'Upstream communication failure or timeout',
              },
              '500': {
                description: 'Server error or upstream unavailable',
              },
            },
          },
        },
        '/api/updates-export': {
          get: {
            summary: 'Private export endpoint — incremental messages since a given timestamp',
            description:
              'Requires X-Api-Key header. Returns messages updated since `since`. Returns 413 if count exceeds the configured limit.',
            parameters: [
              {
                name: 'since',
                in: 'query',
                required: true,
                schema: { type: 'string', format: 'date-time' },
                description: 'ISO 8601 timestamp — return records updated after this point',
              },
            ],
            security: [{ apiKeyAuth: [] }],
            responses: {
              '200': {
                description: 'Export payload with messages',
              },
              '400': {
                description: 'Missing or invalid since parameter',
              },
              '401': {
                description: 'Missing or invalid X-Api-Key',
              },
              '413': {
                description: 'limitExceeded — message count exceeds configured maximum',
              },
              '500': {
                description: 'Server error (missing config or query failure)',
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Api-Key',
          },
        },
      },
    })
  },
}
