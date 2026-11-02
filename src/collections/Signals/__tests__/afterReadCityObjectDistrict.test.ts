import { afterReadCityObjectDistrict } from '../hooks/afterReadCityObjectDistrict'

type District = { id: number; districtId: number; name: string; code: string; createdAt?: string }
type CityObject = { type?: string | null; referenceId?: string | null }

const sredets: District = {
  id: 3,
  districtId: 1,
  name: 'Средец',
  code: 'SRS',
  createdAt: '2026-01-01T00:00:00.000Z',
}

// `district` may be a populated district, an unpopulated id or missing entirely
const makeReq = (
  matches: Array<{ district?: District | number | null }> = [{ district: sredets }]
) => ({
  context: {},
  payload: {
    find: jest.fn(async (_args: unknown) => ({ docs: matches })),
    logger: { error: jest.fn() },
  },
})

type MockReq = ReturnType<typeof makeReq>

const runHook = (req: MockReq, siblingData: CityObject | undefined): Promise<unknown> =>
  Promise.resolve(
    afterReadCityObjectDistrict({ siblingData, req } as unknown as Parameters<
      typeof afterReadCityObjectDistrict
    >[0])
  )

const districtSummary = { id: 3, districtId: 1, name: 'Средец', code: 'SRS' }

describe('afterReadCityObjectDistrict field hook (unit)', () => {
  it('returns undefined without a city object type and reference', async () => {
    for (const siblingData of [
      undefined,
      { type: 'waste-container' },
      { referenceId: 'RTR-0042' },
    ]) {
      const req = makeReq()
      expect(await runHook(req, siblingData)).toBeUndefined()
      expect(req.payload.find).not.toHaveBeenCalled()
    }
  })

  it('returns undefined for city object types without districts', async () => {
    const req = makeReq()
    expect(await runHook(req, { type: 'textile-container', referenceId: '7' })).toBeUndefined()
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it("resolves a waste container's district", async () => {
    const req = makeReq()

    expect(await runHook(req, { type: 'waste-container', referenceId: 'RTR-0042' })).toEqual(
      districtSummary
    )
    expect(req.payload.find).toHaveBeenCalledWith({
      collection: 'waste-containers',
      depth: 1,
      limit: 1,
      overrideAccess: true,
      req,
      select: { district: true },
      where: { publicNumber: { equals: 'RTR-0042' } },
    })
  })

  it("resolves a drinking fountain's district", async () => {
    const req = makeReq()

    expect(await runHook(req, { type: 'drinking-fountain', referenceId: 'SRS-DF-0001' })).toEqual(
      districtSummary
    )
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drinking-fountains' })
    )
  })

  it('looks each city object up only once per request', async () => {
    const req = makeReq()
    const cityObject = { type: 'waste-container', referenceId: 'RTR-0042' }

    await runHook(req, cityObject)
    expect(await runHook(req, cityObject)).toEqual(districtSummary)
    expect(req.payload.find).toHaveBeenCalledTimes(1)

    await runHook(req, { type: 'drinking-fountain', referenceId: 'RTR-0042' })
    expect(req.payload.find).toHaveBeenCalledTimes(2)

    const otherReq = makeReq()
    await runHook(otherReq, cityObject)
    expect(otherReq.payload.find).toHaveBeenCalledTimes(1)
  })

  it('caches city objects without a resolvable district', async () => {
    for (const matches of [[], [{ district: null }], [{ district: 3 }]]) {
      const req = makeReq(matches)
      const cityObject = { type: 'waste-container', referenceId: 'RTR-0042' }

      expect(await runHook(req, cityObject)).toBeUndefined()
      expect(await runHook(req, cityObject)).toBeUndefined()
      expect(req.payload.find).toHaveBeenCalledTimes(1)
    }
  })

  it('logs lookup failures, returns undefined and retries on the next read', async () => {
    const req = makeReq()
    req.payload.find.mockRejectedValueOnce(new Error('db down'))
    const cityObject = { type: 'waste-container', referenceId: 'RTR-0042' }

    expect(await runHook(req, cityObject)).toBeUndefined()
    expect(req.payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))

    expect(await runHook(req, cityObject)).toEqual(districtSummary)
    expect(req.payload.find).toHaveBeenCalledTimes(2)
  })
})
