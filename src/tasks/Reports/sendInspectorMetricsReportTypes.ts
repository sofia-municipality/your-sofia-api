export type MetricsSummary = {
  totalContainers: number
  containersCollectedLast24h: number
  observationsLast24h: number
  containersCollectedLast7d: number
  containersCollectedMonthToDate: number
  activeSignals: number
  newSignalsLast24h: number
  newSignalsLast7d: number
  newSignalsMonthToDate: number
  pendingSignals: number
  inProgressSignals: number
  resolvedSignals: number
}

export type DailyCollectionPoint = {
  date: string
  collectedContainers: number
}
