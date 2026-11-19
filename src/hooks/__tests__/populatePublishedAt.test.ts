import { populatePublishedAt } from '../populatePublishedAt'

type PageData = { title?: string; publishedAt?: string | Date }
type Operation = 'create' | 'update' | 'delete'

const run = (data: PageData, operation: Operation, reqData?: PageData) =>
  populatePublishedAt({ data, operation, req: { data: reqData } } as unknown as Parameters<
    typeof populatePublishedAt
  >[0])

describe('populatePublishedAt hook (unit)', () => {
  const NOW = new Date('2026-03-15T10:30:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each<Operation>(['create', 'update'])(
    'sets publishedAt to now on %s when the request has none',
    (operation) => {
      const data = { title: 'Новина' }

      expect(run(data, operation, { title: 'Новина' })).toEqual({
        title: 'Новина',
        publishedAt: NOW,
      })
    }
  )

  it('keeps an explicitly provided publishedAt', () => {
    const data = { title: 'Новина', publishedAt: '2026-01-01T00:00:00.000Z' }

    expect(run(data, 'update', data)).toBe(data)
  })

  it('does nothing when the request carries no data', () => {
    const data = { title: 'Новина' }

    expect(run(data, 'create', undefined)).toBe(data)
  })

  it('does nothing for other operations', () => {
    const data = { title: 'Новина' }

    expect(run(data, 'delete', {})).toBe(data)
  })
})
