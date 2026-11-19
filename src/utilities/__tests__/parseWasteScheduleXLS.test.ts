import * as XLSX from 'xlsx'
import { parseWasteScheduleXLS } from '../parseWasteScheduleXLS'

type Cell = string | number
type Row = Cell[]

// Feb 2026: 28 days, 1 Feb is a Sunday.
const YEAR = 2026
const FEB = 2

const HEADER_ROWS: Row[] = [
  ['График за сметосъбиране — район Триадица'],
  // Looks like a service row, but sits inside the fixed header block.
  [1, 'ул. Заглавна 1', 'Контейнер 1100 л', 20],
  ['№', 'Адрес', 'Съд', 'Кратност', 1, 2, 3, 4, 5, 6, 7],
]

const toBuffer = (sheets: Record<string, Row[]>): Buffer => {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }) as Buffer
}

const schedule = (rows: Row[]): Buffer => toBuffer({ График: [...HEADER_ROWS, ...rows] })

const serviceRow = (address: string, krat: Cell, grid: Cell[] = []): Row => [
  1,
  address,
  'Контейнер 1100 л',
  krat,
  ...grid,
]

/** Day-grid cells (day 1 first) with `mark` on the given days of the month. */
const gridWith = (markedDays: number[], mark: Cell = 1, length = 31): Cell[] =>
  Array.from({ length }, (_, i) => (markedDays.includes(i + 1) ? mark : ''))

describe('parseWasteScheduleXLS', () => {
  it.each([
    [56, [1, 2, 3, 4, 5, 6, 7], 2],
    [28, [1, 2, 3, 4, 5, 6, 7], 1],
    [24, [1, 2, 3, 4, 5, 6], 1],
    [20, [1, 2, 3, 4, 5], 1],
  ])('maps кратност %p to ISO weekdays %p, %p time(s) a day', (krat, daysOfWeek, timesPerDay) => {
    const entries = parseWasteScheduleXLS(schedule([serviceRow('ул. Витоша 5', krat)]), YEAR, FEB)

    expect(entries).toEqual([{ address: 'ул. Витоша 5', daysOfWeek, timesPerDay, krat }])
  })

  it('accepts кратност stored as text and trims the address', () => {
    const entries = parseWasteScheduleXLS(
      schedule([serviceRow('  ул. Пиротска 10  ', '24'), serviceRow('бул. Витоша 1', ' 20 ')]),
      YEAR,
      FEB
    )

    expect(entries).toEqual([
      { address: 'ул. Пиротска 10', daysOfWeek: [1, 2, 3, 4, 5, 6], timesPerDay: 1, krat: 24 },
      { address: 'бул. Витоша 1', daysOfWeek: [1, 2, 3, 4, 5], timesPerDay: 1, krat: 20 },
    ])
  })

  it('ignores the three header rows', () => {
    const entries = parseWasteScheduleXLS(schedule([serviceRow('ул. Витоша 5', 20)]), YEAR, FEB)

    expect(entries.map((entry) => entry.address)).toEqual(['ул. Витоша 5'])
  })

  it('skips sector and zone headers, totals, row numbers and empty addresses', () => {
    const entries = parseWasteScheduleXLS(
      schedule([
        serviceRow('Сектор 1', 20),
        serviceRow('Зона А', 20),
        serviceRow('Всичко за сектора', 400),
        serviceRow('ОБЩО', 1200),
        serviceRow('125', 20),
        serviceRow('', 20),
        [],
        serviceRow('ул. Витоша 5', 20),
      ]),
      YEAR,
      FEB
    )

    expect(entries.map((entry) => entry.address)).toEqual(['ул. Витоша 5'])
  })

  it.each(['', 0, 'няма'])('skips rows with unusable кратност %p', (krat) => {
    expect(parseWasteScheduleXLS(schedule([serviceRow('ул. Витоша 5', krat)]), YEAR, FEB)).toEqual(
      []
    )
  })

  it('infers weekdays from the day grid for a non-standard кратност', () => {
    // 2 Feb and 9 Feb are Mondays, 5 Feb and 12 Feb are Thursdays.
    const entries = parseWasteScheduleXLS(
      schedule([serviceRow('ул. Солунска 20', 8, gridWith([2, 5, 9, 12], 'x'))]),
      YEAR,
      FEB
    )

    expect(entries).toEqual([
      { address: 'ул. Солунска 20', daysOfWeek: [1, 4], timesPerDay: 1, krat: 8 },
    ])
  })

  it('aligns the day grid with the weekday the given month starts on', () => {
    const buffer = schedule([serviceRow('ул. Солунска 20', 8, gridWith([1, 2]))])

    // 1 Feb 2026 is a Sunday (ISO 7); 1 Jun 2026 is a Monday.
    expect(parseWasteScheduleXLS(buffer, 2026, 2)[0]?.daysOfWeek).toEqual([1, 7])
    expect(parseWasteScheduleXLS(buffer, 2026, 6)[0]?.daysOfWeek).toEqual([1, 2])
  })

  it('ignores grid columns past the last day of the month', () => {
    // 3 Feb 2026 is a Tuesday; days 29–31 do not exist in February 2026.
    const entries = parseWasteScheduleXLS(
      schedule([
        serviceRow('ул. Солунска 20', 8, gridWith([3, 30])),
        serviceRow('ул. Позитано 7', 8, gridWith([29, 30, 31])),
      ]),
      YEAR,
      FEB
    )

    expect(entries).toEqual([
      { address: 'ул. Солунска 20', daysOfWeek: [2], timesPerDay: 1, krat: 8 },
    ])
  })

  it('honours 29 February in leap years', () => {
    // 29 Feb 2028 is a Tuesday.
    const entries = parseWasteScheduleXLS(
      schedule([serviceRow('ул. Позитано 7', 8, gridWith([29]))]),
      2028,
      2
    )

    expect(entries[0]?.daysOfWeek).toEqual([2])
  })

  it('skips non-standard кратност rows with an empty day grid', () => {
    expect(
      parseWasteScheduleXLS(schedule([serviceRow('ул. Солунска 20', 8, gridWith([]))]), YEAR, FEB)
    ).toEqual([])
  })

  it('reads only the first sheet', () => {
    const buffer = toBuffer({
      График: [...HEADER_ROWS, serviceRow('ул. Витоша 5', 20)],
      Резерв: [...HEADER_ROWS, serviceRow('ул. Друга 1', 20)],
    })

    expect(parseWasteScheduleXLS(buffer, YEAR, FEB).map((entry) => entry.address)).toEqual([
      'ул. Витоша 5',
    ])
  })

  it('returns no entries for a sheet with only headers or a non-spreadsheet file', () => {
    expect(parseWasteScheduleXLS(schedule([]), YEAR, FEB)).toEqual([])
    expect(parseWasteScheduleXLS(Buffer.from('not a spreadsheet'), YEAR, FEB)).toEqual([])
  })
})
