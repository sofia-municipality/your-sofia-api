import { afterChangeUpdateContainer } from '../hooks/afterChangeUpdateContainer'

type SignalDoc = {
  id: number
  category: string
  cityObject?: { type?: string; referenceId?: string }
  containerState?: string[]
}
type ContainerDoc = { id: number; status: string; state?: string[] | null }
type HookArgs = { doc: SignalDoc; operation: 'create' | 'update' }

const makePayload = (
  containers: ContainerDoc[] = [{ id: 3, status: 'active', state: ['dirty'] }]
) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: containers })),
  update: jest.fn(async (_args: unknown) => ({})),
  logger: { info: jest.fn(), error: jest.fn() },
})

type MockPayload = ReturnType<typeof makePayload>

const runHook = (payload: MockPayload, args: HookArgs): Promise<SignalDoc> =>
  afterChangeUpdateContainer({ ...args, req: { payload } } as unknown as Parameters<
    typeof afterChangeUpdateContainer
  >[0])

const containerSignal = (overrides: Partial<SignalDoc> = {}): SignalDoc => ({
  id: 1,
  category: 'waste-container',
  cityObject: { type: 'waste-container', referenceId: 'RTR-0042' },
  containerState: ['full', 'dirty'],
  ...overrides,
})

describe('afterChangeUpdateContainer hook (unit)', () => {
  it('only runs on create', async () => {
    const payload = makePayload()
    const doc = containerSignal()

    await expect(runHook(payload, { doc, operation: 'update' })).resolves.toBe(doc)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('ignores signals that do not reference a waste container', async () => {
    const docs = [
      containerSignal({ category: 'drinking-fountain' }),
      containerSignal({ cityObject: { type: 'drinking-fountain', referenceId: 'RTR-DF-0001' } }),
      containerSignal({ cityObject: { type: 'waste-container' } }),
    ]

    for (const doc of docs) {
      const payload = makePayload()
      await expect(runHook(payload, { doc, operation: 'create' })).resolves.toBe(doc)
      expect(payload.find).not.toHaveBeenCalled()
    }
  })

  it('marks the container full and merges the reported states', async () => {
    const payload = makePayload()
    const doc = containerSignal()

    await expect(runHook(payload, { doc, operation: 'create' })).resolves.toBe(doc)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'waste-containers',
      where: { publicNumber: { equals: 'RTR-0042' } },
      limit: 1,
    })
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'waste-containers',
      id: 3,
      data: { status: 'full', state: ['dirty', 'full'] },
    })
  })

  it('only merges states when the container is already full', async () => {
    const payload = makePayload([{ id: 3, status: 'full', state: null }])

    await runHook(payload, {
      doc: containerSignal({ containerState: ['damaged'] }),
      operation: 'create',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: ['damaged'] } })
    )
  })

  it('does not update the container when the signal reports no state', async () => {
    for (const containerState of [undefined, []]) {
      const payload = makePayload()
      await runHook(payload, { doc: containerSignal({ containerState }), operation: 'create' })
      expect(payload.find).toHaveBeenCalled()
      expect(payload.update).not.toHaveBeenCalled()
    }
  })

  it('does nothing when the container is not found', async () => {
    const payload = makePayload([])
    await runHook(payload, { doc: containerSignal(), operation: 'create' })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('logs failures without failing the signal', async () => {
    const payload = makePayload()
    payload.update.mockRejectedValueOnce(new Error('db down'))
    const doc = containerSignal()

    await expect(runHook(payload, { doc, operation: 'create' })).resolves.toBe(doc)
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
