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
    description: 'Comma-separated OboApp category ids',
  },
  {
    name: 'timespanEndGte',
    in: 'query',
    schema: { type: 'string', format: 'date-time' },
    description:
      'ISO timestamp lower bound for message timespan end. Defaults to today start when omitted.',
  },
]

export const updatesOpenApi: Endpoint = {
  path: '/updates/openapi',
  method: 'get',
  handler: async () => {
    return Response.json({
      openapi: '3.1.0',
      info: {
        title: 'Your Sofia API - Updates Proxy',
        version: '1.0.0',
      },
      paths: {
        '/api/updates': {
          get: {
            summary: 'Proxy updates list from upstream public messages API',
            parameters: listParameters,
            responses: {
              '200': {
                description: 'Updates response proxied from upstream public API',
              },
              '400': {
                description: 'Upstream bad request response (passed through)',
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
              '500': {
                description:
                  'Proxy configuration error (missing/invalid OBOAPP_UPDATES_BASE_URL or missing OBOAPP_API_KEY)',
              },
              '502': {
                description: 'Upstream communication failure or timeout',
              },
            },
          },
        },
        '/api/updates/by-id': {
          get: {
            summary: 'Proxy single update by id from upstream public messages API',
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
                description: 'Single update response proxied from upstream public API',
              },
              '400': {
                description:
                  'Missing id parameter or upstream bad request response (passed through)',
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
              '500': {
                description:
                  'Proxy configuration error (missing/invalid OBOAPP_UPDATES_BASE_URL or missing OBOAPP_API_KEY)',
              },
              '502': {
                description: 'Upstream communication failure or timeout',
              },
            },
          },
        },
        '/api/updates/sources': {
          get: {
            summary: 'Proxy update sources metadata from upstream public API',
            responses: {
              '200': {
                description: 'Sources metadata response proxied from upstream public API',
              },
              '400': {
                description: 'Upstream bad request response (passed through)',
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
              '500': {
                description:
                  'Proxy configuration error (missing/invalid OBOAPP_UPDATES_BASE_URL or missing OBOAPP_API_KEY)',
              },
              '502': {
                description: 'Upstream communication failure or timeout',
              },
            },
          },
        },
      },
    })
  },
}
