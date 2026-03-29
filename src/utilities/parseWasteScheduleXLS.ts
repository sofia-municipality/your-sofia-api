import * as XLSX from 'xlsx'

export interface ScheduleEntry {
  address: string
  daysOfWeek: number[]
  timesPerDay: number
  krat: number
}

/**
 * Parse a waste collection schedule XLS buffer.
 * Returns one ScheduleEntry per service address row.
 * Skips sector headers, subtotals, and empty rows.
 *
 * year/month are required to correctly derive day-of-week when the кратност value
 * falls outside the known set (20/24/28/56) and the grid-column fallback is used.
 */
export function parseWasteScheduleXLS(
  buffer: Buffer,
  year: number,
  month: number
): ScheduleEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

  const SKIP_ROWS = 3
  const entries: ScheduleEntry[] = []

  for (let i = SKIP_ROWS; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const address = String(row[1] ?? '').trim()
    const kratRaw = row[3]

    if (!address) continue
    if (address.startsWith('Сектор ') || address.startsWith('Зона ')) continue
    if (address.includes('Всичко') || address.includes('ОБЩО')) continue
    if (/^\d+$/.test(address)) continue

    const krat = typeof kratRaw === 'number' ? kratRaw : parseInt(String(kratRaw), 10)
    if (!krat || isNaN(krat)) continue

    const { daysOfWeek, timesPerDay } = deriveDaysFromKrat(krat, rows, i, year, month)
    if (daysOfWeek.length === 0) continue

    entries.push({ address, daysOfWeek, timesPerDay, krat })
  }

  return entries
}

/**
 * Derive weekly schedule from кратност value.
 * Verified against Feb 2026 Triaditsa file:
 *   56 = twice-daily, every day
 *   28 = once daily, every day  ← verified for February (28-day month); behaviour for
 *        31-day months (krat=31 would be daily then) is unverified — treat as Mon–Sun
 *   24 = Mon–Sat (Sunday off)
 *   20 = Mon–Fri (Saturday + Sunday off)
 */
function deriveDaysFromKrat(
  krat: number,
  rows: string[][],
  rowIdx: number,
  year: number,
  month: number
): { daysOfWeek: number[]; timesPerDay: number } {
  switch (krat) {
    case 56:
      return { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], timesPerDay: 2 }
    case 28:
      return { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], timesPerDay: 1 }
    case 24:
      return { daysOfWeek: [1, 2, 3, 4, 5, 6], timesPerDay: 1 }
    case 20:
      return { daysOfWeek: [1, 2, 3, 4, 5], timesPerDay: 1 }
    default:
      return inferDaysFromGrid(rows, rowIdx, year, month)
  }
}

/**
 * Fallback: infer scheduled days by reading which of the ~31 day-columns have values.
 * The first day-column (col index 4) corresponds to day 1 of the given year/month.
 */
function inferDaysFromGrid(
  rows: string[][],
  rowIdx: number,
  year: number,
  month: number
): { daysOfWeek: number[]; timesPerDay: number } {
  const row = rows[rowIdx]
  if (!row) return { daysOfWeek: [], timesPerDay: 1 }
  // JS getDay(): 0=Sun, 1=Mon, …, 6=Sat
  const firstDayJS = new Date(year, month - 1, 1).getDay()
  // new Date(year, month, 0) = last day of target month
  const daysInMonth = new Date(year, month, 0).getDate()
  const daySet = new Set<number>()

  for (let col = 4; col < row.length; col++) {
    if (col - 4 >= daysInMonth) break
    const val = row[col]
    if (val !== '' && val !== null && val !== undefined) {
      const offset = col - 4
      const jsDay = (firstDayJS + offset) % 7
      const isoDay = jsDay === 0 ? 7 : jsDay
      daySet.add(isoDay)
    }
  }

  const daysOfWeek = Array.from(daySet).sort((a, b) => a - b)
  return { daysOfWeek, timesPerDay: 1 }
}
