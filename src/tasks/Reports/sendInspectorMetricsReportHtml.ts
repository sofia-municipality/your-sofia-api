import type { DailyCollectionPoint, MetricsSummary } from './sendInspectorMetricsReportTypes'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('bg-BG').format(value)
}

function formatDayLabel(dateIso: string): string {
  const date = new Date(dateIso)
  return date.toLocaleDateString('bg-BG', { weekday: 'short' })
}

function renderCollectionTrendSvg(points: DailyCollectionPoint[]): string {
  const width = 700
  const height = 260
  const margin = 36
  const innerWidth = width - margin * 2
  const innerHeight = height - margin * 2
  const values = points.map((point) => point.collectedContainers)
  const maxValue = Math.max(...values, 1)
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth
  const path = points
    .map((point, index) => {
      const x = margin + index * xStep
      const y = margin + innerHeight - (point.collectedContainers / maxValue) * innerHeight
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const circles = points
    .map((point, index) => {
      const x = margin + index * xStep
      const y = margin + innerHeight - (point.collectedContainers / maxValue) * innerHeight
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#2F54C5" />`
    })
    .join('')

  const xLabels = points
    .map((point, index) => {
      const x = margin + index * xStep
      return `<text x="${x.toFixed(1)}" y="${height - 8}" fill="#65758a" font-size="12" text-anchor="middle">${formatDayLabel(point.date)}</text>`
    })
    .join('')

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = margin + innerHeight - ratio * innerHeight
      const value = Math.round(maxValue * ratio)
      return `<g><line x1="${margin}" y1="${y.toFixed(1)}" x2="${width - margin}" y2="${y.toFixed(1)}" stroke="#E9EEF8" stroke-width="1" /><text x="${margin - 8}" y="${y.toFixed(1)}" fill="#65758a" font-size="11" text-anchor="end" dominant-baseline="middle">${value}</text></g>`
    })
    .join('')

  return `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="#f6f8ff" />
        ${gridLines}
        <path d="${path}" fill="none" stroke="#2F54C5" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
        ${circles}
        ${xLabels}
        <text x="${margin}" y="24" fill="#2f3c5f" font-size="14" font-weight="700">Събрани контейнери</text>
      </svg>`
}

function renderSignalStatusSvg(summary: MetricsSummary): string {
  const width = 700
  const height = 220
  const categories = [
    { label: 'Чакащ', value: summary.pendingSignals, color: '#2F54C5' },
    { label: 'В процес', value: summary.inProgressSignals, color: '#65A0FF' },
    { label: 'Разрешени', value: summary.resolvedSignals, color: '#85BBFF' },
  ]
  const maxValue = Math.max(...categories.map((item) => item.value), 1)
  const barWidth = 120
  const gap = 70
  const trackHeight = 120

  const bars = categories
    .map((item, index) => {
      const x = 70 + index * (barWidth + gap)
      const barHeight = Math.max(24, Math.round((item.value / maxValue) * trackHeight))
      const y = height - 60 - barHeight
      return `
          <g>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="14" fill="${item.color}" />
            <text x="${x + barWidth / 2}" y="${y - 12}" fill="#2f3c5f" font-size="14" font-weight="700" text-anchor="middle">${item.value}</text>
            <text x="${x + barWidth / 2}" y="${height - 20}" fill="#65758a" font-size="13" text-anchor="middle">${item.label}</text>
          </g>`
    })
    .join('')

  return `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="#f6f8ff" />
        <text x="40" y="28" fill="#2f3c5f" font-size="14" font-weight="700">Статус на активните сигнали</text>
        ${bars}
      </svg>`
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
    <style>
      body {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
        align-items: flex-start;
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
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
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
        align-items: flex-start;
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
      .link-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 28px;
        border-radius: 999px;
        color: #fff;
        background: #2f54c5;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        margin-right: 12px;
        margin-bottom: 8px;
        border: none;
        box-shadow: 0 2px 8px rgba(47, 84, 197, 0.08);
        transition: background 0.2s;
      }
      .link-button:hover {
        background: #082e8e;
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
    <div class="container">
      <div class="dashboard-header">
        <div>
          <h1>Оперативен доклад за метрики</h1>
          <p>Актуални показатели за сметосъбиране и сигнали към ${generatedAt}</p>
        </div>
      </div>

      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Общо контейнери</div>
          <div class="summary-value">${formatNumber(summary.totalContainers)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Събрани през последните 24 ч.</div>
          <div class="summary-value">${formatNumber(summary.containersCollectedLast24h)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Активни сигнали</div>
          <div class="summary-value">${formatNumber(summary.activeSignals)}</div>
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-title">Тенденция на събирането през последните 7 дни</div>
        <a href="${metricsUrl}" style="display:block; color:inherit; text-decoration:none;">
          ${renderCollectionTrendSvg(collectionTrend)}
        </a>
        <div class="chart-caption">Кликнете върху графиката, за да отворите пълната метрика и да видите дългосрочна тенденция.</div>
      </div>

      <div class="signals-section">
        <div class="signals-title">Сигнали</div>
        <div class="signals-grid">
          <div class="signal-card">
            <div class="signal-label">Новопостъпили за 24 ч.</div>
            <div class="signal-value">${formatNumber(summary.newSignalsLast24h)}</div>
          </div>
          <div class="signal-card">
            <div class="signal-label">В процес</div>
            <div class="signal-value">${formatNumber(summary.inProgressSignals)}</div>
          </div>
          <div class="signal-card">
            <div class="signal-label">Активни</div>
            <div class="signal-value">${formatNumber(summary.activeSignals)}</div>
          </div>
          <div class="signal-card">
            <div class="signal-label">Решени</div>
            <div class="signal-value">${formatNumber(summary.resolvedSignals)}</div>
          </div>
        </div>
        <a href="${metricsUrl}" style="display:block; color:inherit; text-decoration:none;">
          ${renderSignalStatusSvg(summary)}
        </a>
      </div>

      <div class="links-section">
        <a href="${metricsUrl}" class="link-button">Отвори метрики</a>
        <a href="${mapUrl}" class="link-button">Отвори административната карта</a>
      </div>

      <div class="footer">
        <p>Изпратено автоматично от системата на Твоята София.</p>
      </div>
    </div>
  </body>
</html>`
}
