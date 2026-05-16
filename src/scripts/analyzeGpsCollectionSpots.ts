/**
 * GPS Collection Spot Analysis
 *
 * Fetches GPS data for a given firmId over the last N days using multiple
 * 12-hour chunks (API limit), clusters Shooter=true events into unique
 * collection spots, and cross-checks results against DB observations.
 *
 * Usage:
 *   pnpm tsx --env-file=.env src/scripts/analyzeGpsCollectionSpots.ts
 *   pnpm tsx --env-file=.env src/scripts/analyzeGpsCollectionSpots.ts --firm 94 --days 2
 */

import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../payload.config'
import {
  type WasteCollectionEvent,
  type CollectionSpot,
  formatApiDate,
  parseGpsTime,
  groupIntoSpots,
} from '../tasks/WasteCollection/gpsCollectionHelpers'

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_FIRM_ID = 94
const DEFAULT_DAYS = 2
const CHUNK_HOURS = 12
const SPOT_CLUSTER_RADIUS_METERS = 20 // must match production value

// ── Time window helpers ───────────────────────────────────────────────────────

/**
 * Split the last `days * 24` hours into chunks of `chunkHours` each,
 * oldest-first. Returns array of { from, to } strings in GPS API format.
 */
function buildWindows(
  days: number,
  chunkHours: number,
  now: Date = new Date()
): Array<{ from: string; to: string }> {
  const totalHours = days * 24
  const windows: Array<{ from: string; to: string }> = []
  for (let offset = totalHours; offset > 0; offset -= chunkHours) {
    const from = new Date(now.getTime() - offset * 60 * 60 * 1000)
    const to = new Date(now.getTime() - (offset - chunkHours) * 60 * 60 * 1000)
    windows.push({ from: formatApiDate(from), to: formatApiDate(to) })
  }
  return windows
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchWindow(
  baseUrl: string,
  apiKey: string,
  firmId: number,
  from: string,
  to: string
): Promise<WasteCollectionEvent[]> {
  const url =
    `${baseUrl}/get_vehicle.php` +
    `?f=${firmId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) {
    console.warn(`    ⚠ HTTP ${res.status} ${res.statusText} for window ${from} → ${to}`)
    return []
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    console.warn(`    ⚠ Unexpected response shape for window ${from} → ${to}:`, typeof data)
    return []
  }
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bar(n: number, max: number, width = 30): string {
  const filled = Math.round((n / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string, def: string): string => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? (args[idx + 1] ?? def) : def
  }

  const firmId = parseInt(getArg('--firm', String(DEFAULT_FIRM_ID)), 10)
  const days = parseFloat(getArg('--days', String(DEFAULT_DAYS)))
  const chunkHours = parseInt(getArg('--chunk', String(CHUNK_HOURS)), 10)
  const regionFilter = getArg('--region', '') ? parseInt(getArg('--region', ''), 10) : null

  const baseUrl = process.env.INSPECTORAT_GPS_API_BASE_URL ?? ''
  const apiKey = process.env.INSPECTORAT_GPS_API_KEY ?? ''

  if (!baseUrl || !apiKey) {
    console.error('ERROR: INSPECTORAT_GPS_API_BASE_URL and INSPECTORAT_GPS_API_KEY must be set')
    process.exit(1)
  }

  const now = new Date()
  const analysisStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const windows = buildWindows(days, chunkHours, now)

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║        GPS Collection Spot Analysis                  ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  FirmId  : ${firmId}`)
  console.log(
    `  Period  : last ${days * 24}h  (${analysisStart.toISOString()} → ${now.toISOString()})`
  )
  console.log(`  Chunks  : ${windows.length} × ${chunkHours}h`)
  console.log(`  Cluster : ${SPOT_CLUSTER_RADIUS_METERS}m radius`)
  if (regionFilter !== null) console.log(`  Filter  : Region ${regionFilter} only`)
  console.log()

  // ── Fetch all windows ───────────────────────────────────────────────────────
  console.log('── Fetching GPS data ──────────────────────────────────────')
  let allEvents: WasteCollectionEvent[] = []

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!
    process.stdout.write(`  [${i + 1}/${windows.length}]  ${w.from}  →  ${w.to}  … `)
    const events = await fetchWindow(baseUrl, apiKey, firmId, w.from, w.to)
    const shooterCount = events.filter((e) => e.Shooter === true).length
    console.log(`${String(events.length).padStart(6)} events  (${shooterCount} shooter)`)
    allEvents = allEvents.concat(events)
  }

  // ── Basic stats ─────────────────────────────────────────────────────────────
  const shooterEvents = allEvents.filter((e) => e.Shooter === true)
  const spots = groupIntoSpots(shooterEvents, SPOT_CLUSTER_RADIUS_METERS)

  // Apply optional region filter after clustering (region comes from latestEvent)
  const filteredSpots =
    regionFilter !== null ? spots.filter((s) => s.latestEvent.Region === regionFilter) : spots
  const filteredShooterEvents =
    regionFilter !== null ? shooterEvents.filter((e) => e.Region === regionFilter) : shooterEvents
  const vehicles = new Set(
    (regionFilter !== null ? allEvents.filter((e) => e.Region === regionFilter) : allEvents).map(
      (e) => e.VehicleId
    )
  )

  const regionLabel = regionFilter !== null ? ` (Region ${regionFilter})` : ''
  console.log('\n── Summary ────────────────────────────────────────────────')
  console.log(
    `  Total GPS events     : ${allEvents.length}${regionFilter !== null ? `  (${allEvents.filter((e) => e.Region === regionFilter).length} in Region ${regionFilter})` : ''}`
  )
  console.log(
    `  Shooter=true events  : ${shooterEvents.length}${regionFilter !== null ? `  (${filteredShooterEvents.length} in Region ${regionFilter})` : ''}`
  )
  console.log(
    `  Unique vehicles      : ${vehicles.size}  [${Array.from(vehicles)
      .sort((a, b) => a - b)
      .join(', ')}]${regionLabel}`
  )
  console.log(
    `  Collection spots     : ${filteredSpots.length}${regionFilter !== null ? ` in Region ${regionFilter}` : ''}  (clustered at ${SPOT_CLUSTER_RADIUS_METERS}m)`
  )

  if (filteredSpots.length === 0) {
    console.log('\n  No shooter events → nothing to analyse.')
    process.exit(0)
  }

  // ── By region ───────────────────────────────────────────────────────────────
  if (regionFilter === null) {
    console.log('\n── Spots by Region ────────────────────────────────────────')
    const byRegion = new Map<number, CollectionSpot[]>()
    for (const spot of filteredSpots) {
      const r = spot.latestEvent.Region
      if (!byRegion.has(r)) byRegion.set(r, [])
      byRegion.get(r)!.push(spot)
    }
    const maxRegionCount = Math.max(...Array.from(byRegion.values()).map((v) => v.length))
    const sortedRegions = Array.from(byRegion.entries()).sort((a, b) => b[1].length - a[1].length)
    for (const [region, rSpots] of sortedRegions) {
      console.log(
        `  Region ${String(region).padStart(2)}  ${String(rSpots.length).padStart(4)} spots  ${bar(rSpots.length, maxRegionCount, 20)}`
      )
    }
  }

  // ── By vehicle ──────────────────────────────────────────────────────────────
  console.log('\n── Spots by Vehicle ───────────────────────────────────────')
  const byVehicle = new Map<number, number>()
  for (const spot of filteredSpots) {
    const v = spot.latestEvent.VehicleId
    byVehicle.set(v, (byVehicle.get(v) ?? 0) + 1)
  }
  const maxVehicleCount = Math.max(...Array.from(byVehicle.values()))
  const sortedVehicles = Array.from(byVehicle.entries()).sort((a, b) => b[1] - a[1])
  for (const [vehicle, count] of sortedVehicles) {
    console.log(
      `  Vehicle ${String(vehicle).padStart(6)}  ${String(count).padStart(4)} spots  ${bar(count, maxVehicleCount, 20)}`
    )
  }

  // ── Hourly distribution ─────────────────────────────────────────────────────
  console.log('\n── Spots per Hour (UTC) ───────────────────────────────────')
  const byHour = new Map<string, number>()
  for (const spot of filteredSpots) {
    const ts = parseGpsTime(spot.latestEvent.GpsTime)
    const hour = ts.toISOString().slice(0, 13) + ':00Z'
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
  }
  const maxHourCount = Math.max(...Array.from(byHour.values()))
  const sortedHours = Array.from(byHour.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [hour, count] of sortedHours) {
    console.log(`  ${hour}  ${String(count).padStart(4)}  ${bar(count, maxHourCount, 25)}`)
  }

  // ── Spots with many GPS pings ────────────────────────────────────────────────
  const highFreqSpots = filteredSpots.filter((s) => s.events.length >= 3)
  if (highFreqSpots.length > 0) {
    console.log(`\n── High-Ping Spots (≥3 GPS hits per spot, top 10) ─────────`)
    const topSpots = [...highFreqSpots]
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, 10)
    for (const s of topSpots) {
      console.log(
        `  ${s.events.length.toString().padStart(3)} pings  Lat ${s.centroidLat.toFixed(5)}  Lng ${s.centroidLng.toFixed(5)}` +
          `  Region ${s.latestEvent.Region}  Vehicle ${s.latestEvent.VehicleId}`
      )
    }
  }

  // ── Full spot listing (only when a region filter is active) ──────────────────
  if (regionFilter !== null) {
    console.log(`\n── All Collection Spots — Region ${regionFilter} ─────────────────────`)
    console.log(
      `  ${'#'.padEnd(4)}  ${'Lat'.padEnd(10)}  ${'Lng'.padEnd(11)}  ${'Pings'.padEnd(6)}  ${'Vehicle'.padEnd(8)}  ${'Time (GPS/UTC)'.padEnd(24)}  First ping`
    )
    console.log(`  ${'─'.repeat(95)}`)
    const sortedByTime = [...filteredSpots].sort(
      (a, b) =>
        parseGpsTime(a.events[0].GpsTime).getTime() - parseGpsTime(b.events[0].GpsTime).getTime()
    )
    sortedByTime.forEach((s, idx) => {
      const t = parseGpsTime(s.events[0].GpsTime).toISOString()
      console.log(
        `  ${String(idx + 1).padStart(4)}  ${s.centroidLat.toFixed(5).padEnd(10)}  ${s.centroidLng.toFixed(5).padEnd(11)}` +
          `  ${String(s.events.length).padStart(5)}  ${String(s.latestEvent.VehicleId).padEnd(8)}  ${t}`
      )
    })
  }

  // ── DB cross-check ──────────────────────────────────────────────────────────
  console.log('\n── DB Cross-check ─────────────────────────────────────────')
  try {
    const payload = await getPayload({ config })
    const fromIso = analysisStart.toISOString()
    const toIso = now.toISOString()

    // Observations created for this firm in the analysis window (optionally filtered by district)
    const obsResult =
      regionFilter !== null
        ? await payload.db.drizzle.execute(sql`
          SELECT
            COUNT(*)::int                          AS total_obs,
            COUNT(DISTINCT wco.container_id)::int  AS unique_containers
          FROM waste_container_observations wco
          JOIN waste_containers wc ON wc.id = wco.container_id
          WHERE wco.cleaned_at >= ${fromIso}::timestamptz
            AND wco.cleaned_at <= ${toIso}::timestamptz
            AND wco.firm_id    =  ${firmId}
            AND wc.district_id =  ${regionFilter}
        `)
        : await payload.db.drizzle.execute(sql`
          SELECT
            COUNT(*)::int                          AS total_obs,
            COUNT(DISTINCT wco.container_id)::int  AS unique_containers
          FROM waste_container_observations wco
          WHERE wco.cleaned_at >= ${fromIso}::timestamptz
            AND wco.cleaned_at <= ${toIso}::timestamptz
            AND wco.firm_id    =  ${firmId}
        `)
    const obsRow = obsResult.rows[0] as { total_obs: number; unique_containers: number } | undefined

    // All containers breakdown by status
    const contResult = await payload.db.drizzle.execute(sql`
      SELECT status, COUNT(*)::int AS total
      FROM waste_containers
      GROUP BY status
      ORDER BY total DESC
    `)
    const contRows = contResult.rows as { status: string; total: number }[]

    // Missing containers created by GPS in the analysis window (source = third_party, status = pending)
    const pendingResult = await payload.db.drizzle.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM waste_containers
      WHERE source = 'third_party'
        AND status = 'pending'
        AND created_at >= ${fromIso}::timestamptz
    `)
    const pendingRow = pendingResult.rows[0] as { total: number } | undefined

    console.log()
    console.log(
      `  GPS collection spots (firm ${firmId}, last ${days * 24}h${regionFilter !== null ? `, Region ${regionFilter}` : ''}):`
    )
    console.log(`    ${filteredSpots.length} unique spots`)
    console.log()

    if (obsRow) {
      console.log(`  DB observations (firm ${firmId}, same window):`)
      console.log(`    ${obsRow.total_obs} total observation rows`)
      console.log(`    ${obsRow.unique_containers} distinct containers with observations`)

      const diff = filteredSpots.length - obsRow.unique_containers
      console.log()
      if (diff === 0) {
        console.log(`  ✓ GPS spots = DB containers with observations (${filteredSpots.length})`)
      } else if (diff > 0) {
        console.log(`  ⚠ ${diff} GPS spots have no matching DB observation`)
        console.log(`    → could be missing containers, skipped observations, or radius mismatch`)
      } else {
        console.log(`  ℹ DB has ${-diff} more unique containers than GPS spots`)
        console.log(
          `    → likely multi-firm collections on same container, or observation time-window offset`
        )
      }
    }

    console.log()
    console.log(
      `  New auto-created (pending) containers since analysis start: ${pendingRow?.total ?? 'n/a'}`
    )

    console.log()
    console.log(`  All containers by status:`)
    for (const row of contRows) {
      console.log(`    ${row.status.padEnd(12)}: ${row.total}`)
    }

    process.exit(0)
  } catch (err) {
    console.warn(`  (DB comparison skipped — could not connect to Payload)`)
    console.warn(`  Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('\nFatal:', err)
  process.exit(1)
})
