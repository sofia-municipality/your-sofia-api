// Mock push notifications utility to avoid expo-server-sdk ESM issues
jest.mock('../../utilities/pushNotifications', () => ({
  sendNewsNotification: jest.fn(),
}))

import type { AccessArgs } from 'payload'
import { sendNewsNotification } from '../../utilities/pushNotifications'
import { News } from '../News'

const mockSendNewsNotification = jest.mocked(sendNewsNotification)

type Operation = 'read' | 'create' | 'update' | 'delete'
type MockUser = { id: number; role: string } | null
type NewsDoc = {
  id: number
  title: string
  description: string
  status: 'draft' | 'published'
  pushNotification?: boolean
}

const NOW = '2026-03-15T10:30:00.000Z'

const checkAccess = (operation: Operation, user: MockUser) => {
  const rule = News.access?.[operation]
  if (!rule) throw new Error(`News has no ${operation} access rule`)
  return rule({ req: { user } } as unknown as AccessArgs)
}

const runPublishedAtHook = (value: Date | undefined, status: NewsDoc['status']) => {
  const field = News.fields.find(
    (candidate) => 'name' in candidate && candidate.name === 'publishedAt'
  )
  const hook = field && 'hooks' in field ? field.hooks?.beforeChange?.[0] : undefined
  if (!hook) throw new Error('News.publishedAt has no beforeChange hook')
  return hook({ value, siblingData: { status } } as unknown as Parameters<typeof hook>[0])
}

const makePayload = () => ({ logger: { info: jest.fn(), error: jest.fn() } })

const runAfterChange = (payload: ReturnType<typeof makePayload>, doc: NewsDoc) => {
  const hook = News.hooks?.afterChange?.[0]
  if (!hook) throw new Error('News has no afterChange hook')
  return hook({ doc, operation: 'update', req: { payload } } as unknown as Parameters<
    typeof hook
  >[0])
}

const publishedNews = (overrides: Partial<NewsDoc> = {}): NewsDoc => ({
  id: 1,
  title: 'Ремонт на бул. Витоша',
  description: 'Движението ще бъде затворено',
  status: 'published',
  pushNotification: true,
  ...overrides,
})

describe('News collection access', () => {
  it('lets admins read every news item, including drafts', async () => {
    expect(await checkAccess('read', { id: 1, role: 'admin' })).toBe(true)
  })

  it('limits everyone else to published news', async () => {
    for (const user of [null, { id: 5, role: 'user' }, { id: 2, role: 'inspector' }]) {
      expect(await checkAccess('read', user)).toEqual({ status: { equals: 'published' } })
    }
  })

  it('lets only admins create, edit or delete news', async () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(await checkAccess(operation, { id: 1, role: 'admin' })).toBe(true)
      for (const role of ['inspector', 'containerAdmin', 'user']) {
        expect(await checkAccess(operation, { id: 2, role })).toBe(false)
      }
      expect(await checkAccess(operation, null)).toBe(false)
    }
  })
})

describe('News publishedAt field hook', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(NOW) })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('defaults publishedAt to now when news is published', async () => {
    expect(await runPublishedAtHook(undefined, 'published')).toEqual(new Date(NOW))
  })

  it('keeps an explicit publish date', async () => {
    const publishedAt = new Date('2026-01-01T08:00:00.000Z')
    expect(await runPublishedAtHook(publishedAt, 'published')).toBe(publishedAt)
  })

  it('leaves drafts without a publish date', async () => {
    expect(await runPublishedAtHook(undefined, 'draft')).toBeUndefined()
  })
})

describe('News afterChange hook — push notification', () => {
  it('notifies subscribers when news is published with push notifications enabled', async () => {
    const payload = makePayload()
    const doc = publishedNews()

    await runAfterChange(payload, doc)

    expect(mockSendNewsNotification).toHaveBeenCalledWith(payload, doc)
    expect(payload.logger.error).not.toHaveBeenCalled()
  })

  it('does not notify for drafts or when push notifications are disabled', async () => {
    for (const doc of [
      publishedNews({ status: 'draft' }),
      publishedNews({ pushNotification: false }),
    ]) {
      await runAfterChange(makePayload(), doc)
    }
    expect(mockSendNewsNotification).not.toHaveBeenCalled()
  })

  it('logs delivery failures without failing the save', async () => {
    mockSendNewsNotification.mockRejectedValueOnce(new Error('expo down'))
    const payload = makePayload()

    await expect(runAfterChange(payload, publishedNews())).resolves.toBeUndefined()
    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('expo down'))
  })
})
