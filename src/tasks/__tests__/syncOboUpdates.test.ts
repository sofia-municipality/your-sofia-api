// ─── Mock the OBO REST source ───────────────────────────────────────────────

jest.mock('../../lib/oboUpdatesSource', () => ({
  fetchActiveUpdates: jest.fn(),
  isOboRestConfigured: jest.fn(() => true),
}))

import { runSyncOboUpdates } from '../Updates/syncOboUpdates'
import { fetchActiveUpdates, isOboRestConfigured } from '../../lib/oboUpdatesSource'
import type { UpdateMessage } from '../../lib/oboMessageMapper'

const mockFetch = fetchActiveUpdates as jest.Mock
const mockConfigured = isOboRestConfigured as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function msg(overrides: Partial<UpdateMessage> = {}): UpdateMessage {
  return {
    id: 'm1',
    text: 'msg',
    createdAt: '2026-01-01T00:00:00.000Z',
    timespanEnd: '2026-01-10T00:00:00.000Z',
    finalizedAt: '2026-01-01T02:00:00.000Z',
    locality: 'bg.sofia',
    ...overrides,
  }
}

function makePayload(existingDocs: { id: number | string; oboId: string }[] = []) {
  return {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    find: jest.fn().mockResolvedValue({ docs: existingDocs }),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ docs: [] }),
  }
}

beforeEach(() => {
  mockConfigured.mockReturnValue(true)
})
afterEach(() => jest.clearAllMocks())

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runSyncOboUpdates', () => {
  it('skips when the OBO REST API is not configured', async () => {
    mockConfigured.mockReturnValue(false)
    const payload = makePayload()
    const out = await runSyncOboUpdates(payload as any)
    expect(out).toEqual({ fetched: 0, upserted: 0, pruned: 0, skipped: 0 })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('leaves the cache untouched when the fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('upstream down'))
    const payload = makePayload([{ id: 1, oboId: 'a' }])
    const out = await runSyncOboUpdates(payload as any)
    expect(out.fetched).toBe(0)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('creates rows for new messages', async () => {
    mockFetch.mockResolvedValue([msg({ id: 'a' }), msg({ id: 'b' })])
    const payload = makePayload([])
    const out = await runSyncOboUpdates(payload as any)
    expect(payload.create).toHaveBeenCalledTimes(2)
    expect(payload.update).not.toHaveBeenCalled()
    expect(out).toMatchObject({ fetched: 2, upserted: 2, pruned: 0, skipped: 0 })
    const created = payload.create.mock.calls[0][0]
    expect(created.collection).toBe('obo-updates')
    expect(created.data.oboId).toBe('a')
    expect(created.data.data.id).toBe('a')
  })

  it('updates existing rows by id instead of creating', async () => {
    mockFetch.mockResolvedValue([msg({ id: 'a', text: 'updated' })])
    const payload = makePayload([{ id: 42, oboId: 'a' }])
    const out = await runSyncOboUpdates(payload as any)
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update.mock.calls[0][0].id).toBe(42)
    expect(out).toMatchObject({ upserted: 1, pruned: 0 })
  })

  it('prunes rows that disappeared upstream', async () => {
    mockFetch.mockResolvedValue([msg({ id: 'a' })])
    const payload = makePayload([
      { id: 1, oboId: 'a' },
      { id: 2, oboId: 'stale' },
    ])
    const out = await runSyncOboUpdates(payload as any)
    expect(payload.delete).toHaveBeenCalledTimes(1)
    expect(payload.delete.mock.calls[0][0].where).toEqual({ id: { in: [2] } })
    expect(out.pruned).toBe(1)
  })

  it('does not prune when the fetch returns zero messages', async () => {
    mockFetch.mockResolvedValue([])
    const payload = makePayload([{ id: 1, oboId: 'a' }])
    const out = await runSyncOboUpdates(payload as any)
    expect(payload.delete).not.toHaveBeenCalled()
    expect(out).toMatchObject({ fetched: 0, pruned: 0 })
  })

  it('skips messages without a stable id', async () => {
    mockFetch.mockResolvedValue([msg({ id: undefined }), msg({ id: 'ok' })])
    const payload = makePayload([])
    const out = await runSyncOboUpdates(payload as any)
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ fetched: 2, upserted: 1, skipped: 1 })
  })
})
