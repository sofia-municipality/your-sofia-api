// payload uses ESM — mock it so Jest can import the hook's APIError
jest.mock('payload', () => ({
  APIError: class APIError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  },
}))

import {
  beforeValidateSignal,
  validateSignalLocation,
  validateSignalReferenceId,
} from '../hooks/beforeValidateSignal'

// The duplicate-signal check is covered in src/collections/__tests__/Signals.test.ts.

const UNPINNED_SIGNAL_ERROR = 'Signal must have a location or an assigned city object.'

type Location = [number, number]
type SignalData = {
  category?: string
  reporterUniqueId?: string
  location?: unknown
  address?: string
  cityObject?: { type?: string; referenceId?: string; name?: string }
}
type FindArgs = { collection: string; where?: { and?: Array<Record<string, unknown>> } }
type FindResult = { docs: Array<{ id?: string; location?: Location }>; totalDocs: number }

// Point fields store coordinates as [longitude, latitude]
const CONTAINER_LOCATION: Location = [23.32, 42.69]
const LOCATION_11M_AWAY: Location = [23.32, 42.6901]
const LOCATION_100M_AWAY: Location = [23.32, 42.6909]

const makePayload = ({
  containers = [{ location: CONTAINER_LOCATION }],
  signalsToday = 0,
  duplicates = [],
}: {
  containers?: Array<{ location?: Location }>
  signalsToday?: number
  duplicates?: Array<{ id: string }>
} = {}) => ({
  find: jest.fn(async ({ collection, where }: FindArgs): Promise<FindResult> => {
    if (collection === 'waste-containers') return { docs: containers, totalDocs: containers.length }
    const isDailyCount = (where?.and ?? []).some((clause) => 'createdAt' in clause)
    if (isDailyCount) return { docs: [], totalDocs: signalsToday }
    return { docs: duplicates, totalDocs: duplicates.length }
  }),
  create: jest.fn(async (_args: { collection: string; data: Record<string, unknown> }) => ({
    id: 99,
  })),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runHook = (
  data: SignalData,
  payload: MockPayload,
  { role = 'user', operation = 'create' }: { role?: string; operation?: 'create' | 'update' } = {}
): Promise<SignalData> =>
  beforeValidateSignal({
    data,
    operation,
    req: { user: { id: 1, role }, payload },
  } as unknown as Parameters<typeof beforeValidateSignal>[0])

const containerSignal = (overrides: SignalData = {}): SignalData => ({
  category: 'waste-container',
  location: LOCATION_11M_AWAY,
  cityObject: { type: 'waste-container', referenceId: 'RTR-0042' },
  ...overrides,
})

const isDailyCountCall = ([args]: [FindArgs]) =>
  (args.where?.and ?? []).some((clause) => 'createdAt' in clause)

describe('validateSignalReferenceId (unit)', () => {
  const validate = (value: string | null | undefined, data: SignalData, operation = 'create') =>
    validateSignalReferenceId(value, { data, operation } as unknown as Parameters<
      typeof validateSignalReferenceId
    >[1])

  it('only validates creates', () => {
    expect(validate(undefined, {}, 'update')).toBe(true)
  })

  it('accepts a reference id or a valid location', () => {
    expect(validate('RTR-0042', {})).toBe(true)
    expect(validate(undefined, { location: CONTAINER_LOCATION })).toBe(true)
  })

  it('rejects a signal with neither a reference id nor a valid location', () => {
    expect(validate(undefined, {})).toBe(UNPINNED_SIGNAL_ERROR)
    expect(validate('', { location: [23.32] })).toBe(UNPINNED_SIGNAL_ERROR)
    expect(validate(null, { location: [0, 42.69] })).toBe(UNPINNED_SIGNAL_ERROR)
  })
})

describe('validateSignalLocation (unit)', () => {
  const validate = (value: unknown, data: SignalData, operation = 'create') =>
    validateSignalLocation(
      value as Location,
      { data, operation } as unknown as Parameters<typeof validateSignalLocation>[1]
    )

  it('only validates creates', () => {
    expect(validate(undefined, {}, 'update')).toBe(true)
  })

  it('accepts a valid location or a city object reference', () => {
    expect(validate(CONTAINER_LOCATION, {})).toBe(true)
    expect(validate(undefined, { cityObject: { referenceId: 'RTR-0042' } })).toBe(true)
  })

  it('rejects a signal with neither a valid location nor a city object reference', () => {
    expect(validate(undefined, {})).toBe(UNPINNED_SIGNAL_ERROR)
    expect(validate([23.32, 42.69, 5], { cityObject: {} })).toBe(UNPINNED_SIGNAL_ERROR)
  })
})

describe('beforeValidateSignal hook (unit)', () => {
  it('ignores updates', async () => {
    const payload = makePayload()
    const data = containerSignal({ location: LOCATION_100M_AWAY })

    await expect(runHook(data, payload, { operation: 'update' })).resolves.toBe(data)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('rejects signals without a location or a city object reference', async () => {
    const payload = makePayload()

    await expect(runHook({ category: 'other', cityObject: {} }, payload)).rejects.toMatchObject({
      status: 400,
      message: UNPINNED_SIGNAL_ERROR,
    })
    expect(payload.logger.warn).toHaveBeenCalled()
  })

  describe('proximity check', () => {
    it('accepts a waste-container signal within 30 meters of the container', async () => {
      const payload = makePayload()
      const data = containerSignal()

      await expect(runHook(data, payload)).resolves.toBe(data)
      expect(payload.find).toHaveBeenCalledWith({
        collection: 'waste-containers',
        where: { publicNumber: { equals: 'RTR-0042' } },
        limit: 1,
      })
    })

    it('rejects a waste-container signal more than 30 meters from the container', async () => {
      const payload = makePayload()

      await expect(
        runHook(containerSignal({ location: LOCATION_100M_AWAY }), payload)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('within 30 meters'),
      })
    })

    it('lets admins report from any distance', async () => {
      const payload = makePayload()
      const data = containerSignal({ location: LOCATION_100M_AWAY })

      await expect(runHook(data, payload, { role: 'admin' })).resolves.toBe(data)
      expect(payload.find).not.toHaveBeenCalled()
    })

    it('accepts the signal when the container is unknown or has no location', async () => {
      for (const containers of [[], [{}]]) {
        const data = containerSignal({ location: LOCATION_100M_AWAY })
        await expect(runHook(data, makePayload({ containers }))).resolves.toBe(data)
      }
    })

    it('accepts the signal when the container lookup fails', async () => {
      const payload = makePayload()
      payload.find.mockRejectedValueOnce(new Error('db down'))
      const data = containerSignal({ location: LOCATION_100M_AWAY })

      await expect(runHook(data, payload)).resolves.toBe(data)
      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking proximity')
      )
    })
  })

  describe('container auto-creation', () => {
    const newContainerSignal = (): SignalData => ({
      category: 'waste-container',
      location: CONTAINER_LOCATION,
      address: 'ул. Граф Игнатиев 1',
      cityObject: { type: 'waste-container', name: 'Ъгъла' },
    })

    it('creates a community container for a waste-container signal without a reference', async () => {
      const payload = makePayload()

      const result = await runHook(newContainerSignal(), payload)

      expect(payload.create).toHaveBeenCalledWith({
        collection: 'waste-containers',
        data: {
          publicNumber: expect.stringMatching(/^SOF-WASTE-[0-9a-f-]{36}$/),
          status: 'active',
          source: 'community',
          wasteType: 'general',
          capacitySize: 'standard',
          capacityVolume: 3,
          location: CONTAINER_LOCATION,
          address: 'ул. Граф Игнатиев 1',
          notes: 'Auto-created from signal. Ъгъла',
        },
        draft: false,
      })
      const [createArgs] = payload.create.mock.calls[0] ?? []
      expect(result.cityObject?.referenceId).toBe(createArgs?.data.publicNumber)
    })

    it('fails the signal when the container cannot be created', async () => {
      const payload = makePayload()
      payload.create.mockRejectedValueOnce(new Error('boom'))

      await expect(runHook(newContainerSignal(), payload)).rejects.toMatchObject({
        status: 500,
        message: 'Failed to create new waste container: boom',
      })
    })
  })

  describe('daily limit', () => {
    const anonymousReport = (): SignalData => ({
      category: 'other',
      location: CONTAINER_LOCATION,
      reporterUniqueId: 'R1',
    })

    it('counts the reporter signals created since the start of the day', async () => {
      const payload = makePayload({ signalsToday: 4 })
      const data = anonymousReport()

      await expect(runHook(data, payload)).resolves.toBe(data)
      expect(payload.find).toHaveBeenCalledWith({
        collection: 'signals',
        overrideAccess: true,
        where: {
          and: [
            { reporterUniqueId: { equals: 'R1' } },
            { createdAt: { greater_than_equal: expect.any(String) } },
          ],
        },
        limit: 0,
      })
    })

    it('rejects the sixth signal of the day', async () => {
      await expect(
        runHook(anonymousReport(), makePayload({ signalsToday: 5 }))
      ).rejects.toMatchObject({
        status: 429,
        message: expect.stringContaining('up to 5 signals per day'),
      })
    })

    it('does not limit admins', async () => {
      const payload = makePayload({ signalsToday: 10 })
      const data = anonymousReport()

      await expect(runHook(data, payload, { role: 'admin' })).resolves.toBe(data)
      expect(payload.find.mock.calls.filter(isDailyCountCall)).toHaveLength(0)
    })

    it('accepts the signal when the count lookup fails', async () => {
      const payload = makePayload()
      payload.find.mockRejectedValueOnce(new Error('db down'))
      const data = anonymousReport()

      await expect(runHook(data, payload)).resolves.toBe(data)
      expect(payload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking daily signal limit')
      )
    })
  })

  it('accepts the signal when the duplicate lookup fails', async () => {
    const payload = makePayload()
    const data = containerSignal({ reporterUniqueId: 'R1' })
    // Proximity and daily-count lookups succeed; the duplicate lookup fails
    payload.find
      .mockResolvedValueOnce({ docs: [{ location: CONTAINER_LOCATION }], totalDocs: 1 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockRejectedValueOnce(new Error('db down'))

    await expect(runHook(data, payload)).resolves.toBe(data)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error checking for duplicate signals')
    )
  })
})
