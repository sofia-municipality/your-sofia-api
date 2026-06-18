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
        '/api/updates/webhook': {
          post: {
            summary: 'Receive an update change from OboApp (push)',
            description:
              'Server-to-server webhook. OboApp calls this whenever an update is created, updated or deleted so the local cache stays in sync without waiting for the periodic crawl. Authenticated with the `X-Api-Key` header (OBO_WEBHOOK_API_KEY).',
            parameters: [
              {
                name: 'X-Api-Key',
                in: 'header',
                required: true,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['event'],
                    properties: {
                      event: { type: 'string', enum: ['created', 'updated', 'deleted'] },
                      message: {
                        type: 'object',
                        description: 'Full OBO message object. Required for created/updated.',
                      },
                      id: {
                        type: 'string',
                        description: 'Message id. Required for deleted (or read from message.id).',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Change applied ({ status, event, id, result })' },
              '400': { description: 'Invalid body (bad event, missing message/id)' },
              '401': { description: 'Missing or invalid X-Api-Key' },
              '500': { description: 'Failed to persist the change' },
              '503': { description: 'Webhook not configured (OBO_WEBHOOK_API_KEY unset)' },
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
      },
    })
  },
}
