import type { TaskConfig, TaskHandler } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { parseWasteScheduleXLS } from '../../utilities/parseWasteScheduleXLS'
import { geocodeAddress, sleep } from '../../utilities/geocodeAddress'

const DISTRICTS = [
  // Confirmed present on inspectorat-so.org Feb 2026:
  'BANKIA',
  'ILINDEN',
  'ISKAR',
  'KRASNA_POLIANA',
  'KREMIKOVCI',
  'LOZENEC',
  'MLADOST',
  'NADEJDA',
  'NOVI_ISKUR',
  'OBORISHTE',
  'OVCHA_KUPEL',
  'PANCHAREVO',
  'SERDIKA',
  'SREDEC',
  'STUDENTSKI',
  'TRIADICA',
  // Remaining Sofia districts — gracefully skipped on 404:
  'VITOSHA',
  'VRUBNITSA',
  'VAZRAJDANE',
  'IZGREV',
  'KRASNO_SELO',
  'LYULIN',
  'SLATINA',
]

const BIN_SIZES = ['110', '240', '1100', '2250', '3000', '3750', '4m3']
const SEARCH_RADIUS_METERS = 50
const MATCH_LIMIT = 5

function buildXlsUrl(
  year: number,
  month: number,
  district: string,
  size: string,
  prefix = ''
): string {
  const mm = String(month).padStart(2, '0')
  const yy = String(year).slice(2)
  return `https://inspectorat-so.org/images/${year}/${mm}/${district}/${prefix}bitovo_${size}_${mm}.${yy}.xls`
}

const handler: TaskHandler<'syncWasteCollectionSchedules'> = async ({ input, req }) => {
  const { payload } = req
  const now = new Date()
  const year = input?.year ?? now.getFullYear()
  const month = input?.month ?? now.getMonth()
  const scheduleSourcePrefix = `${year}-${String(month).padStart(2, '0')}`

  const districtsToRun = input?.district ? [input.district] : DISTRICTS
  const sizesToRun = input?.size ? [input.size] : BIN_SIZES

  let filesDownloaded = 0
  let streetsMatched = 0
  let containersUpdated = 0
  let streetsUnmatched = 0
  let districtsProcessed = 0

  for (const district of districtsToRun) {
    const districtHint = district.replace(/_/g, ' ')
    const prefixes = district === 'TRIADICA' ? ['', 'centar_'] : ['']

    for (const prefix of prefixes) {
      for (const size of sizesToRun) {
        const url = buildXlsUrl(year, month, district, size, prefix)

        let buffer: Buffer
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
          if (resp.status === 404) continue
          if (!resp.ok) {
            payload.logger.warn(`[syncSchedules] ${url} → ${resp.status}`)
            continue
          }
          buffer = Buffer.from(await resp.arrayBuffer())
          filesDownloaded++
        } catch (err) {
          if (err instanceof Error && err.name === 'TimeoutError') {
            payload.logger.warn(`[syncSchedules] fetch timed out: ${url}`)
          } else {
            payload.logger.warn(`[syncSchedules] fetch failed: ${url}: ${String(err)}`)
          }
          continue
        }

        let entries
        try {
          entries = parseWasteScheduleXLS(buffer, year, month)
        } catch (err) {
          payload.logger.error(`[syncSchedules] parse failed: ${url}: ${String(err)}`)
          continue
        }

        payload.logger.info(`[syncSchedules] ${district}/${size}: ${entries.length} entries`)

        for (const entry of entries) {
          const point = await geocodeAddress(entry.address, districtHint, payload)

          // Always sleep to respect Nominatim's 1 req/s policy.
          // Monthly background task — time cost is acceptable.
          await sleep(1100)

          if (!point) {
            streetsUnmatched++
            payload.logger.debug(`[syncSchedules] geocode miss: "${entry.address}"`)
            continue
          }

          const nearbyResult = await payload.db.drizzle.execute(sql`
            SELECT id FROM waste_containers
            WHERE ST_DWithin(
              ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
              location,
              ${SEARCH_RADIUS_METERS}
            )
            ORDER BY ST_Distance(
              ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
              location
            ) ASC
            LIMIT ${MATCH_LIMIT}
          `)

          const containerIds = ((nearbyResult?.rows ?? []) as { id: number }[]).map((r) => r.id)

          if (containerIds.length === 0) {
            streetsUnmatched++
            continue
          }

          streetsMatched++

          for (const id of containerIds) {
            await payload.update({
              collection: 'waste-containers',
              id,
              data: {
                collectionDaysOfWeek: entry.daysOfWeek.map(String) as (
                  | '1'
                  | '2'
                  | '3'
                  | '4'
                  | '5'
                  | '6'
                  | '7'
                )[],
                collectionTimesPerDay: entry.timesPerDay,
                scheduleSource: `${scheduleSourcePrefix}/${district}/${size}`,
              },
              overrideAccess: true,
            })
            containersUpdated++
          }
        }
      }
    }
    districtsProcessed++
  }

  payload.logger.info(
    `[syncSchedules] Done. districts=${districtsProcessed} files=${filesDownloaded} ` +
      `matched=${streetsMatched} unmatched=${streetsUnmatched} updated=${containersUpdated}`
  )

  return {
    output: {
      districtsProcessed,
      filesDownloaded,
      streetsMatched,
      containersUpdated,
      streetsUnmatched,
    },
  }
}

export const syncWasteCollectionSchedules: TaskConfig<'syncWasteCollectionSchedules'> = {
  slug: 'syncWasteCollectionSchedules',
  label: 'Sync Waste Collection Schedules from inspectorat-so.org',
  schedule: [{ cron: '0 3 28 * *', queue: 'default' }], // 3am on the 28th of every month
  inputSchema: [
    { name: 'year', type: 'number' },
    { name: 'month', type: 'number' },
    { name: 'district', type: 'text' },
    { name: 'size', type: 'text' },
  ],
  outputSchema: [
    { name: 'districtsProcessed', type: 'number', required: true },
    { name: 'filesDownloaded', type: 'number', required: true },
    { name: 'streetsMatched', type: 'number', required: true },
    { name: 'containersUpdated', type: 'number', required: true },
    { name: 'streetsUnmatched', type: 'number', required: true },
  ],
  retries: 1,
  handler,
}
