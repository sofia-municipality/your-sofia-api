/**
 * @jest-environment jsdom
 */
import { buildHtmlReport } from '../sendInspectorMetricsReportHtml'
import type { DailyCollectionPoint, MetricsSummary } from '../sendInspectorMetricsReportTypes'

const METRICS_URL = 'https://api.sofia.bg/admin/metrics'
const MAP_URL = 'https://api.sofia.bg/admin/waste-map'
const GENERATED_AT = '16.11.2026 г., 7:00'
const NBSP = ' '

const makeSummary = (overrides: Partial<MetricsSummary> = {}): MetricsSummary => ({
  totalContainers: 12345,
  containersCollectedLast24h: 87,
  observationsLast24h: 120,
  containersCollectedLast7d: 640,
  containersCollectedMonthToDate: 1500,
  activeSignals: 15,
  newSignalsLast24h: 4,
  newSignalsLast7d: 30,
  newSignalsMonthToDate: 52,
  pendingSignals: 10,
  inProgressSignals: 5,
  resolvedSignals: 20,
  ...overrides,
})

// Mon 16 Mar 2026 … Sun 22 Mar 2026
const WEEK: DailyCollectionPoint[] = [
  { date: '2026-03-16', collectedContainers: 100 },
  { date: '2026-03-17', collectedContainers: 50 },
  { date: '2026-03-18', collectedContainers: 0 },
  { date: '2026-03-19', collectedContainers: 25 },
  { date: '2026-03-20', collectedContainers: 1000 },
  { date: '2026-03-21', collectedContainers: 2000 },
  { date: '2026-03-22', collectedContainers: 0 },
]

const render = (summary = makeSummary(), trend = WEEK): Document =>
  new DOMParser().parseFromString(
    buildHtmlReport(summary, trend, METRICS_URL, MAP_URL, false, false, GENERATED_AT),
    'text/html'
  )

const text = (el: Element | null | undefined): string => el?.textContent?.trim() ?? ''

const section = (doc: Document, selector: string): Element => {
  const el = doc.querySelector(selector)
  if (!el) throw new Error(`Missing section ${selector}`)
  return el
}

/** [label, value] pairs of the metric cards inside a section. */
const cards = (container: Element): [string, string][] =>
  Array.from(container.querySelectorAll('.card-cell')).map((cell) => {
    const [label, value] = Array.from(cell.querySelectorAll('div > div'))
    return [text(label), text(value)]
  })

type ChartBar = { label: string; valueLabel: string; height: number }

/** Bars of the bar chart rendered inside the given link, in display order. */
const chartBars = (container: Element): ChartBar[] => {
  const [trackRow, labelRow] = Array.from(
    container.querySelectorAll(':scope > div > table > tbody > tr')
  )
  if (!trackRow || !labelRow) throw new Error('Chart rows not found')
  const tracks = Array.from(trackRow.children)
  const labels = Array.from(labelRow.children)
  return tracks.map((track, i) => ({
    label: text(labels[i]),
    valueLabel: text(track.querySelector(':scope > div')),
    height: Number(track.querySelector('td[bgcolor]')?.getAttribute('height')),
  }))
}

const chartTitle = (container: Element): string =>
  text(container.querySelector(':scope > div > div'))

describe('buildHtmlReport', () => {
  it('produces a Bulgarian document stamped with the generation time', () => {
    const doc = render()

    expect(doc.documentElement.lang).toBe('bg')
    expect(text(doc.querySelector('title'))).toContain('Твоята София')
    expect(text(doc.querySelector('.dashboard-header p'))).toContain(GENERATED_AT)
  })

  it('shows the headline metrics with Bulgarian number formatting', () => {
    const doc = render()

    expect(cards(section(doc, '.summary-cards'))).toEqual([
      ['Общо контейнери', `12${NBSP}345`],
      ['Събрани през последните 24 ч.', '87'],
      ['Активни сигнали', '15'],
    ])
  })

  it('shows the signal breakdown cards', () => {
    const doc = render(makeSummary({ resolvedSignals: 54321 }))

    expect(cards(section(doc, '.signals-grid'))).toEqual([
      ['Новопостъпили за 24 ч.', '4'],
      ['В процес', '5'],
      ['Активни', '15'],
      ['Решени', `54${NBSP}321`],
    ])
  })

  it('charts one bar per day, labelled by weekday and scaled to the busiest day', () => {
    const chartLink = section(render(), '.chart-section a')

    expect(chartLink.getAttribute('href')).toBe(METRICS_URL)
    expect(chartTitle(chartLink)).toBe('Събрани контейнери')
    expect(chartBars(chartLink)).toEqual([
      { label: 'пн', valueLabel: '100', height: 8 },
      { label: 'вт', valueLabel: '50', height: 6 },
      { label: 'ср', valueLabel: '0', height: 6 },
      { label: 'чт', valueLabel: '25', height: 6 },
      { label: 'пт', valueLabel: '1000', height: 75 },
      { label: 'сб', valueLabel: '2000', height: 150 },
      { label: 'нд', valueLabel: '0', height: 6 },
    ])
  })

  it('charts pending, in-progress and resolved signals', () => {
    const chartLink = section(render(), '.signals-section > a')

    expect(chartLink.getAttribute('href')).toBe(METRICS_URL)
    expect(chartTitle(chartLink)).toBe('Статус на активните сигнали')
    expect(chartBars(chartLink)).toEqual([
      { label: 'Чакащ', valueLabel: '10', height: 75 },
      { label: 'В процес', valueLabel: '5', height: 38 },
      { label: 'Разрешени', valueLabel: '20', height: 150 },
    ])
  })

  it('renders minimum-height bars when every value is zero', () => {
    const zeroWeek = WEEK.map((point) => ({ ...point, collectedContainers: 0 }))
    const doc = render(
      makeSummary({ pendingSignals: 0, inProgressSignals: 0, resolvedSignals: 0 }),
      zeroWeek
    )

    const heights = [
      ...chartBars(section(doc, '.chart-section a')),
      ...chartBars(section(doc, '.signals-section > a')),
    ].map((bar) => bar.height)
    expect(heights).toHaveLength(10)
    expect(heights.every((height) => height === 6)).toBe(true)
  })

  // BUG (bugs.md #7): `new Date('YYYY-MM-DD')` is UTC midnight, but the weekday is formatted in the
  // server's time zone, so on servers west of UTC every label is a day early.
  it.failing('labels the chart days by their date on a server west of UTC', () => {
    // Jest ignores TZ changes at runtime, so emulate a server in New York instead.
    const toLocaleDateString = Date.prototype.toLocaleDateString
    const spy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      return toLocaleDateString.call(this, locales, { timeZone: 'America/New_York', ...options })
    })

    try {
      const labels = chartBars(section(render(), '.chart-section a')).map((bar) => bar.label)
      expect(labels).toEqual(['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'])
    } finally {
      spy.mockRestore()
    }
  })

  it('links to the metrics page and the admin map', () => {
    const links = Array.from(section(render(), '.links-section').querySelectorAll('a'))

    expect(links.map((link) => [text(link), link.getAttribute('href')])).toEqual([
      ['Отвори метрики', METRICS_URL],
      ['Отвори административната карта', MAP_URL],
    ])
  })
})
