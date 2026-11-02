import { afterChangeSetFountainPublicNumber } from '../afterChangeSetFountainPublicNumber'

type FountainDoc = {
  id: number
  publicNumber?: string | null
  district?: number | { id?: number } | null
}

const makeReq = (district: { code?: string | null } | null = { code: 'RTR' }) => ({
  payload: {
    findByID: jest.fn(async (_args: unknown) => district),
    update: jest.fn(async (_args: unknown) => ({})),
    logger: { error: jest.fn() },
  },
})

type MockReq = ReturnType<typeof makeReq>

const runHook = (
  req: MockReq,
  doc: FountainDoc,
  operation: 'create' | 'update' = 'create'
): Promise<FountainDoc> =>
  afterChangeSetFountainPublicNumber({ doc, operation, req } as unknown as Parameters<
    typeof afterChangeSetFountainPublicNumber
  >[0])

describe('afterChangeSetFountainPublicNumber hook (unit)', () => {
  it('only runs on create', async () => {
    const req = makeReq()
    const doc = { id: 7, district: 3 }

    await expect(runHook(req, doc, 'update')).resolves.toBe(doc)
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('keeps an existing public number', async () => {
    const req = makeReq()
    const doc = { id: 7, district: 3, publicNumber: 'CUSTOM-1' }

    await expect(runHook(req, doc)).resolves.toBe(doc)
    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('builds the number from the district code and the zero-padded id', async () => {
    const req = makeReq()

    await expect(runHook(req, { id: 7, district: 3 })).resolves.toEqual({
      id: 7,
      district: 3,
      publicNumber: 'RTR-DF-0007',
    })
    expect(req.payload.findByID).toHaveBeenCalledWith({
      collection: 'city-districts',
      id: 3,
      depth: 0,
      req,
    })
    expect(req.payload.update).toHaveBeenCalledWith({
      collection: 'drinking-fountains',
      id: 7,
      data: { publicNumber: 'RTR-DF-0007' },
      req,
      overrideAccess: true,
    })
  })

  it('accepts a populated district and does not truncate long ids', async () => {
    const req = makeReq()

    const result = await runHook(req, { id: 12345, district: { id: 3 } })

    expect(result.publicNumber).toBe('RTR-DF-12345')
    expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
  })

  it('falls back to XXX without a district or district code', async () => {
    const withoutDistrict = makeReq()
    expect((await runHook(withoutDistrict, { id: 7, district: null })).publicNumber).toBe(
      'XXX-DF-0007'
    )
    expect(withoutDistrict.payload.findByID).not.toHaveBeenCalled()

    for (const district of [null, { code: null }]) {
      expect((await runHook(makeReq(district), { id: 7, district: 3 })).publicNumber).toBe(
        'XXX-DF-0007'
      )
    }
  })

  it('falls back to XXX when the district lookup fails', async () => {
    const req = makeReq()
    req.payload.findByID.mockRejectedValueOnce(new Error('db down'))

    expect((await runHook(req, { id: 7, district: 3 })).publicNumber).toBe('XXX-DF-0007')
    expect(req.payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })

  it('returns the doc unchanged when saving the number fails', async () => {
    const req = makeReq()
    req.payload.update.mockRejectedValueOnce(new Error('db down'))
    const doc = { id: 7, district: 3 }

    await expect(runHook(req, doc)).resolves.toBe(doc)
    expect(req.payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to set publicNumber')
    )
  })
})
