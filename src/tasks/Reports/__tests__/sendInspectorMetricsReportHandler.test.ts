jest.mock('payload', () => ({ getPayload: jest.fn() }))
jest.mock('../../../payload.config', () => ({
  __esModule: true,
  default: { mockedConfig: true },
}))
jest.mock('../sendInspectorMetricsReportData', () => ({
  loadInspectorMetricsReportData: jest.fn(),
}))
jest.mock('../sendInspectorMetricsReportHtml', () => ({
  buildHtmlReport: jest.fn(() => '<html>report</html>'),
}))

import { getPayload } from 'payload'
import { buildHtmlReport } from '../sendInspectorMetricsReportHtml'
import { loadInspectorMetricsReportData } from '../sendInspectorMetricsReportData'
import { handler, runInspectorMetricsReport } from '../sendInspectorMetricsReportHandler'
import type { DailyCollectionPoint, MetricsSummary } from '../sendInspectorMetricsReportTypes'

const mockGetPayload = jest.mocked(getPayload)
const mockBuildHtmlReport = jest.mocked(buildHtmlReport)
const mockLoadData = jest.mocked(loadInspectorMetricsReportData)

type UserDoc = { id: number; email?: string | null }
type ConfigOverrides = { serverURL?: string; routes?: { admin?: string } }
type FindArgs = { limit?: number; page?: number; pagination?: boolean }

const SUMMARY = { totalContainers: 10, activeSignals: 2 } as unknown as MetricsSummary
const TREND: DailyCollectionPoint[] = [{ date: '2026-03-15', collectedContainers: 4 }]

const makePayload = (
  users: UserDoc[] = [{ id: 1, email: 'inspector@sofia.bg' }],
  config: ConfigOverrides = { serverURL: 'https://api.sofia.bg', routes: { admin: '/admin' } }
) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: users })),
  config,
  email: {
    defaultFromName: 'Твоята София',
    defaultFromAddress: 'noreply@sofia.bg',
    sendEmail: jest.fn(async (_message: Record<string, unknown>) => ({})),
  },
  logger: { info: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runHandler = (payload: MockPayload) =>
  handler({ req: { payload } } as unknown as Parameters<typeof handler>[0])

type HtmlArgs = Parameters<typeof buildHtmlReport>

const htmlArgs = (): HtmlArgs => {
  const [call] = mockBuildHtmlReport.mock.calls
  if (!call) throw new Error('Expected the HTML report to have been built')
  return call
}

describe('sendInspectorMetricsReport handler (unit)', () => {
  const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL

  beforeEach(() => {
    mockLoadData.mockResolvedValue({ summary: SUMMARY, collectionTrend: TREND })
  })

  afterEach(() => {
    if (originalServerUrl === undefined) {
      Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SERVER_URL')
    } else {
      process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    }
  })

  it('looks up inspectors and admins', async () => {
    const payload = makePayload()

    await runHandler(payload)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { role: { in: ['inspector', 'admin'] } },
        overrideAccess: true,
      })
    )
  })

  it('skips the report when no recipient has an email address', async () => {
    const payload = makePayload([
      { id: 1, email: '' },
      { id: 2, email: '   ' },
      { id: 3, email: null },
      { id: 4 },
    ])

    await expect(runHandler(payload)).resolves.toEqual({ output: { recipients: 0, sent: 0 } })

    expect(mockLoadData).not.toHaveBeenCalled()
    expect(payload.email.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('No inspectors'))
  })

  it('emails the report once to each unique, trimmed address', async () => {
    const payload = makePayload([
      { id: 1, email: ' inspector@sofia.bg ' },
      { id: 2, email: 'inspector@sofia.bg' },
      { id: 3, email: 'admin@sofia.bg' },
    ])

    await expect(runHandler(payload)).resolves.toEqual({ output: { recipients: 2, sent: 2 } })

    const generatedAt = htmlArgs()[6]
    expect(payload.email.sendEmail.mock.calls.map(([message]) => message)).toEqual([
      {
        from: '"Твоята София" <noreply@sofia.bg>',
        to: 'inspector@sofia.bg',
        subject: `Доклад: контейнери и сигнали — ${generatedAt}`,
        html: '<html>report</html>',
      },
      expect.objectContaining({ to: 'admin@sofia.bg', html: '<html>report</html>' }),
    ])
    expect(mockBuildHtmlReport).toHaveBeenCalledTimes(1)
  })

  // BUG (bugs.md #8): recipients are fetched with `limit: 200` and no paging, so everyone past
  // the first 200 is silently dropped.
  it.failing('emails every inspector and admin, even past the first 200', async () => {
    const users = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      email: `inspector${i + 1}@sofia.bg`,
    }))
    const payload = makePayload(users)
    // Behave like Payload: honour limit/page, or return everything without pagination.
    payload.find.mockImplementation(async (args: unknown) => {
      const { limit = 10, page = 1, pagination } = args as FindArgs
      if (pagination === false || limit === 0) {
        return { docs: users, hasNextPage: false, totalDocs: users.length }
      }
      const start = (page - 1) * limit
      return {
        docs: users.slice(start, start + limit),
        hasNextPage: start + limit < users.length,
        totalDocs: users.length,
      }
    })

    await expect(runHandler(payload)).resolves.toEqual({ output: { recipients: 250, sent: 250 } })
  })

  it('builds the report from the loaded metrics', async () => {
    const payload = makePayload()

    await runHandler(payload)

    expect(mockLoadData).toHaveBeenCalledWith(payload, expect.any(Date))
    const [summary, trend] = htmlArgs()
    expect(summary).toBe(SUMMARY)
    expect(trend).toBe(TREND)
  })

  it.each<[string, ConfigOverrides, string, string]>([
    [
      'a plain server URL',
      { serverURL: 'https://api.sofia.bg', routes: { admin: '/admin' } },
      'https://api.sofia.bg/admin/metrics',
      'https://api.sofia.bg/admin/waste-map',
    ],
    [
      'a trailing slash on the server URL',
      { serverURL: 'https://api.sofia.bg/', routes: { admin: '/admin' } },
      'https://api.sofia.bg/admin/metrics',
      'https://api.sofia.bg/admin/waste-map',
    ],
    [
      'an admin route without a leading slash',
      { serverURL: 'https://api.sofia.bg', routes: { admin: 'panel' } },
      'https://api.sofia.bg/panel/metrics',
      'https://api.sofia.bg/panel/waste-map',
    ],
    [
      'an admin route with a trailing slash',
      { serverURL: 'https://api.sofia.bg', routes: { admin: '/panel/' } },
      'https://api.sofia.bg/panel/metrics',
      'https://api.sofia.bg/panel/waste-map',
    ],
    [
      'no configured admin route',
      { serverURL: 'https://api.sofia.bg' },
      'https://api.sofia.bg/admin/metrics',
      'https://api.sofia.bg/admin/waste-map',
    ],
  ])('builds admin links from %s', async (_case, config, metricsUrl, mapUrl) => {
    await runHandler(makePayload(undefined, config))

    const [, , builtMetricsUrl, builtMapUrl] = htmlArgs()
    expect(builtMetricsUrl).toBe(metricsUrl)
    expect(builtMapUrl).toBe(mapUrl)
  })

  it('falls back to NEXT_PUBLIC_SERVER_URL when the config has no server URL', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://env.sofia.bg'

    await runHandler(makePayload(undefined, { serverURL: '', routes: { admin: '/admin' } }))

    expect(htmlArgs()[2]).toBe('https://env.sofia.bg/admin/metrics')
  })

  it('keeps sending to the remaining recipients when one email fails', async () => {
    const payload = makePayload([
      { id: 1, email: 'broken@sofia.bg' },
      { id: 2, email: 'admin@sofia.bg' },
    ])
    payload.email.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'))

    await expect(runHandler(payload)).resolves.toEqual({ output: { recipients: 2, sent: 1 } })

    expect(payload.email.sendEmail).toHaveBeenCalledTimes(2)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/broken@sofia\.bg.*SMTP timeout/)
    )
  })
})

describe('runInspectorMetricsReport (unit)', () => {
  it('initialises Payload from the app config and sends the report', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload as unknown as Awaited<ReturnType<typeof getPayload>>)
    mockLoadData.mockResolvedValue({ summary: SUMMARY, collectionTrend: TREND })

    await expect(runInspectorMetricsReport()).resolves.toEqual({
      output: { recipients: 1, sent: 1 },
    })
    expect(mockGetPayload).toHaveBeenCalledWith({ config: { mockedConfig: true } })
  })
})
