import { formatDateTime } from '../formatDateTime'

// formatDateTime formats in the local time zone, so build inputs from local dates.
const localIso = (...args: [number, number, number, number?]) =>
  new Date(args[0], args[1], args[2], args[3] ?? 12).toISOString()

describe('formatDateTime (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('formats a timestamp as MM/DD/YYYY with zero padding', () => {
    expect(formatDateTime(localIso(2026, 2, 5))).toBe('03/05/2026')
  })

  it('does not pad two-digit months and days', () => {
    expect(formatDateTime(localIso(2026, 11, 24))).toBe('12/24/2026')
  })

  it('uses the current date when the timestamp is empty', () => {
    jest.useFakeTimers({ now: new Date(2026, 0, 9, 12) })

    expect(formatDateTime('')).toBe('01/09/2026')
  })
})
