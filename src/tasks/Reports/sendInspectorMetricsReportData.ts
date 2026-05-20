import { sql } from '@payloadcms/db-postgres'
import type { BasePayload } from 'payload'
import type { DailyCollectionPoint, MetricsSummary } from './sendInspectorMetricsReportTypes'

type TotalContainersRow = { total_containers: number }
type ContainerCountsRow = {
  containers_collected_last_24h: number
  observations_last_24h: number
  containers_collected_last_7d: number
  observations_last_7d: number
  containers_collected_month_to_date: number
}
type SignalCountsRow = {
  active_signals: number
  pending_signals: number
  in_progress_signals: number
  resolved_signals: number
  new_signals_last_24h: number
  new_signals_last_7d: number
  new_signals_month_to_date: number
}
type DailyTrendRow = { date: string; collected_containers: number }

export async function loadInspectorMetricsReportData(
  payload: BasePayload,
  now: Date
): Promise<{ summary: MetricsSummary; collectionTrend: DailyCollectionPoint[] }> {
  const today24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const totalContainersResult = await payload.db.drizzle.execute<TotalContainersRow>(sql`
    SELECT COUNT(*)::int AS total_containers
    FROM waste_containers
  `)

  const containerCountsResult = await payload.db.drizzle.execute<ContainerCountsRow>(sql`
    SELECT
      COUNT(DISTINCT CASE WHEN wco.cleaned_at >= ${today24hAgo.toISOString()}::timestamptz THEN wco.container_id END)::int AS containers_collected_last_24h,
      COUNT(*) FILTER (WHERE wco.cleaned_at >= ${today24hAgo.toISOString()}::timestamptz)::int AS observations_last_24h,
      COUNT(DISTINCT CASE WHEN wco.cleaned_at >= ${weekAgo.toISOString()}::timestamptz THEN wco.container_id END)::int AS containers_collected_last_7d,
      COUNT(*) FILTER (WHERE wco.cleaned_at >= ${weekAgo.toISOString()}::timestamptz)::int AS observations_last_7d,
      COUNT(DISTINCT CASE WHEN wco.cleaned_at >= ${monthStart.toISOString()}::timestamptz THEN wco.container_id END)::int AS containers_collected_month_to_date
    FROM waste_container_observations wco
  `)

  const signalCountsResult = await payload.db.drizzle.execute<SignalCountsRow>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pending', 'in-progress'))::int AS active_signals,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_signals,
      COUNT(*) FILTER (WHERE status = 'in-progress')::int AS in_progress_signals,
      COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_signals,
      COUNT(*) FILTER (WHERE created_at >= ${today24hAgo.toISOString()}::timestamptz)::int AS new_signals_last_24h,
      COUNT(*) FILTER (WHERE created_at >= ${weekAgo.toISOString()}::timestamptz)::int AS new_signals_last_7d,
      COUNT(*) FILTER (WHERE created_at >= ${monthStart.toISOString()}::timestamptz)::int AS new_signals_month_to_date
    FROM signals
  `)

  const dailyTrendResult = await payload.db.drizzle.execute<DailyTrendRow>(sql`
    WITH day_series AS (
      SELECT generate_series(
        DATE_TRUNC('day', ${weekAgo.toISOString()}::timestamptz AT TIME ZONE 'Europe/Sofia')::date,
        DATE_TRUNC('day', ${now.toISOString()}::timestamptz AT TIME ZONE 'Europe/Sofia')::date,
        INTERVAL '1 day'
      )::date AS day
    ),
    collected_per_day AS (
      SELECT
        (wco.cleaned_at AT TIME ZONE 'Europe/Sofia')::date AS day,
        COUNT(DISTINCT wco.container_id)::int AS collected_containers
      FROM waste_container_observations wco
      JOIN waste_containers wc ON wc.id = wco.container_id
      LEFT JOIN city_districts cd ON cd.id = wc.district_id
      WHERE wco.cleaned_at >= ${weekAgo.toISOString()}::timestamptz
        AND wco.cleaned_at <= ${now.toISOString()}::timestamptz
      GROUP BY (wco.cleaned_at AT TIME ZONE 'Europe/Sofia')::date
    )
    SELECT
      ds.day::text AS date,
      COALESCE(cpd.collected_containers, 0)::int AS collected_containers
    FROM day_series ds
    LEFT JOIN collected_per_day cpd ON cpd.day = ds.day
    ORDER BY ds.day
  `)

  const totalContainers = Number(totalContainersResult.rows?.[0]?.total_containers ?? 0)
  const containerCounts = containerCountsResult.rows?.[0] ?? {
    containers_collected_last_24h: 0,
    observations_last_24h: 0,
    containers_collected_last_7d: 0,
    observations_last_7d: 0,
    containers_collected_month_to_date: 0,
  }
  const signalCounts = signalCountsResult.rows?.[0] ?? {
    active_signals: 0,
    pending_signals: 0,
    in_progress_signals: 0,
    resolved_signals: 0,
    new_signals_last_24h: 0,
    new_signals_last_7d: 0,
    new_signals_month_to_date: 0,
  }

  const summary: MetricsSummary = {
    totalContainers,
    containersCollectedLast24h: Number(containerCounts.containers_collected_last_24h ?? 0),
    observationsLast24h: Number(containerCounts.observations_last_24h ?? 0),
    containersCollectedLast7d: Number(containerCounts.containers_collected_last_7d ?? 0),
    containersCollectedMonthToDate: Number(containerCounts.containers_collected_month_to_date ?? 0),
    activeSignals: Number(signalCounts.active_signals ?? 0),
    newSignalsLast24h: Number(signalCounts.new_signals_last_24h ?? 0),
    newSignalsLast7d: Number(signalCounts.new_signals_last_7d ?? 0),
    newSignalsMonthToDate: Number(signalCounts.new_signals_month_to_date ?? 0),
    pendingSignals: Number(signalCounts.pending_signals ?? 0),
    inProgressSignals: Number(signalCounts.in_progress_signals ?? 0),
    resolvedSignals: Number(signalCounts.resolved_signals ?? 0),
  }

  const collectionTrend = (
    dailyTrendResult.rows as { date: string; collected_containers: number }[]
  ).map((row) => ({
    date: row.date,
    collectedContainers: Number(row.collected_containers ?? 0),
  }))

  return { summary, collectionTrend }
}
