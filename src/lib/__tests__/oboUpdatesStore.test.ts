import { buildOboUpdateRow, deleteOboUpdate, upsertOboUpdate } from '../oboUpdatesStore'
import { SOFIA_LOCALITY, type UpdateMessage } from '../oboMessageMapper'

function msg(overrides: Partial<UpdateMessage> = {}): UpdateMessage {
  return {
    id: 'm1',
    text: 'hello',
    createdAt: '2026-01-01T00:00:00.000Z',
    timespanEnd: '2026-01-10T00:00:00.000Z',
    finalizedAt: '2026-01-01T02:00:00.000Z',
    locality: 'bg.sofia',
    ...overrides,
  }
}

function makePayload(existingDocs: { id: number | string }[] = []) {
  return {
    find: jest.fn().mockResolvedValue({ docs: existingDocs }),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ docs: [] }),
  }
}

afterEach(() => jest.clearAllMocks())

describe('buildOboUpdateRow', () => {
  it('maps the indexed columns and stores the message verbatim', () => {
    const row = buildOboUpdateRow(msg({ id: 'abc' }))
    expect(row.oboId).toBe('abc')
    expect(row.locality).toBe('bg.sofia')
    expect(row.timespanEnd).toBe('2026-01-10T00:00:00.000Z')
    expect(row.finalizedAt).toBe('2026-01-01T02:00:00.000Z')
    expect(row.data.id).toBe('abc')
  })

  it('defaults a missing or blank locality to SOFIA_LOCALITY', () => {
    expect(buildOboUpdateRow(msg({ locality: undefined })).locality).toBe(SOFIA_LOCALITY)
    expect(buildOboUpdateRow(msg({ locality: '   ' })).locality).toBe(SOFIA_LOCALITY)
  })

  it('preserves a real non-Sofia locality', () => {
    expect(buildOboUpdateRow(msg({ locality: 'bg.plovdiv' })).locality).toBe('bg.plovdiv')
  })

  it('coerces invalid/absent dates to null', () => {
    const row = buildOboUpdateRow(msg({ timespanEnd: 'not-a-date', finalizedAt: undefined }))
    expect(row.timespanEnd).toBeNull()
    expect(row.finalizedAt).toBeNull()
  })
})

describe('upsertOboUpdate', () => {
  it('creates a row when none exists for the oboId', async () => {
    const payload = makePayload([])
    const result = await upsertOboUpdate(payload as any, msg({ id: 'new' }))
    expect(result).toBe('created')
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create.mock.calls[0][0].data.oboId).toBe('new')
  })

  it('updates the existing row instead of creating a duplicate', async () => {
    const payload = makePayload([{ id: 42 }])
    const result = await upsertOboUpdate(payload as any, msg({ id: 'm1', text: 'edited' }))
    expect(result).toBe('updated')
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update.mock.calls[0][0].id).toBe(42)
    expect(payload.update.mock.calls[0][0].data.data.text).toBe('edited')
  })

  it('looks up the existing row by oboId with overrideAccess', async () => {
    const payload = makePayload([])
    await upsertOboUpdate(payload as any, msg({ id: 'lookup' }))
    expect(payload.find.mock.calls[0][0]).toMatchObject({
      collection: 'obo-updates',
      where: { oboId: { equals: 'lookup' } },
      overrideAccess: true,
    })
  })
})

describe('deleteOboUpdate', () => {
  it('returns the number of rows removed', async () => {
    const payload = makePayload()
    payload.delete.mockResolvedValue({ docs: [{ id: 1 }] })
    const removed = await deleteOboUpdate(payload as any, 'm1')
    expect(removed).toBe(1)
    expect(payload.delete.mock.calls[0][0]).toMatchObject({
      collection: 'obo-updates',
      where: { oboId: { equals: 'm1' } },
      overrideAccess: true,
    })
  })

  it('returns 0 when nothing matched (idempotent)', async () => {
    const payload = makePayload()
    payload.delete.mockResolvedValue({ docs: [] })
    expect(await deleteOboUpdate(payload as any, 'gone')).toBe(0)
  })
})
