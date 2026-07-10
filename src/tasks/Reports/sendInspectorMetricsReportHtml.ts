import type { DailyCollectionPoint, MetricsSummary } from './sendInspectorMetricsReportTypes'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('bg-BG').format(value)
}

function formatDayLabel(dateIso: string): string {
  const date = new Date(dateIso)
  return date.toLocaleDateString('bg-BG', { weekday: 'short' })
}

const CHART_BG = '#f6f8ff'
const TRACK_HEIGHT = 150

type Bar = { label: string; value: number; color: string; valueLabel: string }

function renderBarChart(title: string, bars: Bar[]): string {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1)
  const colWidth = `${Math.round(100 / bars.length)}%`

  const trackCells = bars
    .map((bar) => {
      const barHeight = Math.max(6, Math.round((bar.value / maxValue) * TRACK_HEIGHT))
      return `
              <td valign="bottom" align="center" width="${colWidth}" style="padding:0 8px;">
                <div style="font-size:14px;font-weight:700;color:#2f3c5f;margin-bottom:6px;">${bar.valueLabel}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td width="80" height="${barHeight}" bgcolor="${bar.color}" style="width:80px;max-width:80px;height:${barHeight}px;background:${bar.color};border-radius:12px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>`
    })
    .join('')

  const labelCells = bars
    .map(
      (bar) =>
        `<td align="center" width="${colWidth}" style="padding:10px 8px 0;font-size:13px;color:#65758a;">${bar.label}</td>`
    )
    .join('')

  return `
    <div style="background:${CHART_BG};border-radius:20px;padding:24px 16px;">
      <div style="font-size:14px;font-weight:700;color:#2f3c5f;padding:0 8px 12px;">${title}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>${trackCells}
        </tr>
        <tr>${labelCells}</tr>
      </table>
    </div>`
}

function renderCollectionTrendChart(points: DailyCollectionPoint[]): string {
  const bars: Bar[] = points.map((point) => ({
    label: formatDayLabel(point.date),
    value: point.collectedContainers,
    valueLabel: formatNumber(point.collectedContainers),
    color: '#2F54C5',
  }))
  return renderBarChart('Събрани контейнери', bars)
}

function renderSignalStatusChart(summary: MetricsSummary): string {
  const bars: Bar[] = [
    { label: 'Чакащ', value: summary.pendingSignals, color: '#2F54C5' },
    { label: 'В процес', value: summary.inProgressSignals, color: '#65A0FF' },
    { label: 'Разрешени', value: summary.resolvedSignals, color: '#85BBFF' },
  ].map((bar) => ({ ...bar, valueLabel: formatNumber(bar.value) }))
  return renderBarChart('Статус на активните сигнали', bars)
}

type Card = { label: string; value: string }
type CardStyle = {
  bg: string
  radius: number
  padding: string
  labelSize: number
  valueSize: number
}

function renderCardRow(cards: Card[], style: CardStyle): string {
  const colWidth = (100 / cards.length).toFixed(4)
  const cells = cards
    .map(
      (card) => `
            <td class="card-cell" width="${colWidth}%" valign="top" style="width:${colWidth}%;padding:0 8px;">
              <div style="background:${style.bg};border:1px solid #e6ebf8;border-radius:${style.radius}px;padding:${style.padding};text-align:center;">
                <div style="color:#5d6a85;font-size:${style.labelSize}px;line-height:1.35;margin-bottom:8px;">${card.label}</div>
                <div style="color:#2f54c5;font-size:${style.valueSize}px;font-weight:700;line-height:1.1;">${card.value}</div>
              </div>
            </td>`
    )
    .join('')
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;table-layout:fixed;">
        <tr>${cells}
        </tr>
      </table>`
}

const SUMMARY_CARD_STYLE: CardStyle = {
  bg: '#ffffff',
  radius: 14,
  padding: '26px 12px',
  labelSize: 14,
  valueSize: 32,
}

const SIGNAL_CARD_STYLE: CardStyle = {
  bg: '#f7f9ff',
  radius: 12,
  padding: '18px 10px',
  labelSize: 13,
  valueSize: 26,
}

function linkButton(href: string, label: string): string {
  return `<a href="${href}" class="report-btn" style="display:inline-block;background:#2f54c5;border-radius:999px;padding:14px 28px;text-decoration:none;margin:0 12px 8px 0;font-family:'Sofia Sans',Inter,system-ui,sans-serif;transition:background-color 0.2s ease;"><span style="color:#ffffff;font-size:15px;font-weight:600;">${label}</span></a>`
}

export function buildHtmlReport(
  summary: MetricsSummary,
  collectionTrend: DailyCollectionPoint[],
  metricsUrl: string,
  mapUrl: string,
  includeWeekly: boolean,
  includeMonthly: boolean,
  generatedAt: string
) {
  return `<!DOCTYPE html>
<html lang="bg">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Оперативен доклад за метрики — Твоята София</title>
    <!--[if !mso]><!-->
    <link
      href="https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <!--<![endif]-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;500;600;700&display=swap');
      body {
        font-family: 'Sofia Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
        background: #f4f6fb;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px;
      }

      .container,
      .container h1,
      .container p,
      .container div,
      .container span,
      .container td,
      .container a {
        font-family: 'Sofia Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
      }
      .dashboard-header {
        display: flex;
        align-items: center;
        gap: 18px;
        background: #f7f9ff;
        border-radius: 14px;
        padding: 18px 24px;
        margin-bottom: 32px;
        border: 1px solid #e6ebf8;
      }
      .dashboard-header h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0;
        color: #2f3c5f;
      }
      .dashboard-header p {
        margin: 4px 0 0;
        font-size: 13px;
        color: #65758a;
      }
      .summary-cards {
        display: flex;
        gap: 18px;
        margin-bottom: 36px;
        flex-wrap: wrap;
      }
      .summary-card {
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 4px 24px rgba(38, 70, 123, 0.08);
        padding: 28px 32px;
        min-width: 180px;
        flex: 1 1 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 1px solid #e6ebf8;
      }
      .summary-label {
        color: #5d6a85;
        font-size: 14px;
        margin-bottom: 10px;
      }
      .summary-value {
        font-size: 36px;
        font-weight: 700;
        color: #2f54c5;
        line-height: 1.1;
      }
      .chart-section,
      .signals-section,
      .links-section {
        background: #fff;
        border-radius: 18px;
        border: 1px solid #e9eef8;
      }
      .chart-section,
      .signals-section {
        padding: 28px;
        margin-bottom: 32px;
      }
      .links-section {
        padding: 28px;
        margin-bottom: 32px;
      }
      .chart-title,
      .signals-title {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 18px;
        color: #2f3c5f;
      }
      .chart-caption {
        margin-top: 14px;
        font-size: 13px;
        color: #6a7180;
      }
      .signals-grid {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .signal-card {
        background: #f7f9ff;
        border-radius: 12px;
        padding: 18px 22px;
        min-width: 140px;
        flex: 1 1 140px;
        border: 1px solid #e6ebf8;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .signal-label {
        color: #5d6a85;
        font-size: 13px;
        margin-bottom: 8px;
      }
      .signal-value {
        font-size: 28px;
        font-weight: 700;
        color: #2f54c5;
      }
      .report-btn:hover {
        background-color: #082e8e !important;
      }

      @media only screen and (max-width: 600px) {
        .container {
          padding: 20px 14px !important;
        }
        .card-cell {
          display: block !important;
          width: 100% !important;
          padding: 0 0 10px 0 !important;
        }
        .report-btn {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
          text-align: center !important;
          margin: 0 0 12px 0 !important;
        }
      }
      .footer {
        font-size: 13px;
        color: #7a859c;
        margin-top: 24px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container" style="font-family:'Sofia Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div class="dashboard-header">
        <div>
          <h1>Оперативен доклад за метрики</h1>
          <p>Актуални показатели за сметосъбиране и сигнали към ${generatedAt}</p>
        </div>
      </div>

      <div class="summary-cards">
        ${renderCardRow(
          [
            { label: 'Общо контейнери', value: formatNumber(summary.totalContainers) },
            {
              label: 'Събрани през последните 24 ч.',
              value: formatNumber(summary.containersCollectedLast24h),
            },
            { label: 'Активни сигнали', value: formatNumber(summary.activeSignals) },
          ],
          SUMMARY_CARD_STYLE
        )}
      </div>

      <div class="chart-section">
        <div class="chart-title">Тенденция на събирането през последните 7 дни</div>
        <a href="${metricsUrl}" style="display:block; color:inherit; text-decoration:none;">
          ${renderCollectionTrendChart(collectionTrend)}
        </a>
        <div class="chart-caption">Кликнете върху графиката, за да отворите пълната метрика и да видите дългосрочна тенденция.</div>
      </div>

      <div class="signals-section">
        <div class="signals-title">Сигнали</div>
        <div class="signals-grid">
          ${renderCardRow(
            [
              { label: 'Новопостъпили за 24 ч.', value: formatNumber(summary.newSignalsLast24h) },
              { label: 'В процес', value: formatNumber(summary.inProgressSignals) },
              { label: 'Активни', value: formatNumber(summary.activeSignals) },
              { label: 'Решени', value: formatNumber(summary.resolvedSignals) },
            ],
            SIGNAL_CARD_STYLE
          )}
        </div>
        <a href="${metricsUrl}" style="display:block; color:inherit; text-decoration:none;">
          ${renderSignalStatusChart(summary)}
        </a>
      </div>

      <div class="links-section">
        ${linkButton(metricsUrl, 'Отвори метрики')}
        ${linkButton(mapUrl, 'Отвори административната карта')}
      </div>

      <div class="footer">
        <p>Изпратено автоматично от системата на Твоята София.</p>
      </div>
    </div>
  </body>
</html>`
}
