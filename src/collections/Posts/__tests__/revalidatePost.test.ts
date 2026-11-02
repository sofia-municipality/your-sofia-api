jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import { revalidateDelete, revalidatePost } from '../hooks/revalidatePost'

type PostDoc = { slug?: string; _status?: 'draft' | 'published' }

const makeReq = (context: Record<string, unknown> = {}) => ({
  context,
  payload: { logger: { info: jest.fn() } },
})

const runChange = (doc: PostDoc, previousDoc: PostDoc = {}, context?: Record<string, unknown>) =>
  revalidatePost({ doc, previousDoc, req: makeReq(context) } as unknown as Parameters<
    typeof revalidatePost
  >[0])

const runDelete = (doc: PostDoc, context?: Record<string, unknown>) =>
  revalidateDelete({ doc, req: makeReq(context) } as unknown as Parameters<
    typeof revalidateDelete
  >[0])

describe('revalidatePost hook (unit)', () => {
  it('revalidates a published post and the sitemap', () => {
    const doc: PostDoc = { slug: 'new-bike-lanes', _status: 'published' }

    expect(runChange(doc)).toBe(doc)
    expect(revalidatePath).toHaveBeenCalledWith('/posts/new-bike-lanes')
    expect(revalidateTag).toHaveBeenCalledWith('posts-sitemap', {})
  })

  it('revalidates the old path when a post is unpublished', () => {
    runChange(
      { slug: 'new-bike-lanes', _status: 'draft' },
      { slug: 'bike-lanes', _status: 'published' }
    )

    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/posts/bike-lanes')
    expect(revalidateTag).toHaveBeenCalledWith('posts-sitemap', {})
  })

  it('does nothing for drafts that were never published', () => {
    runChange({ slug: 'bike-lanes', _status: 'draft' }, { slug: 'bike-lanes', _status: 'draft' })

    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('does nothing when revalidation is disabled', () => {
    runChange(
      { slug: 'bike-lanes', _status: 'published' },
      { slug: 'bike-lanes', _status: 'published' },
      { disableRevalidate: true }
    )

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('revalidateDelete hook (unit)', () => {
  it('revalidates the deleted post and the sitemap', () => {
    const doc: PostDoc = { slug: 'bike-lanes' }

    expect(runDelete(doc)).toBe(doc)
    expect(revalidatePath).toHaveBeenCalledWith('/posts/bike-lanes')
    expect(revalidateTag).toHaveBeenCalledWith('posts-sitemap', {})
  })

  it('does nothing when revalidation is disabled', () => {
    runDelete({ slug: 'bike-lanes' }, { disableRevalidate: true })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
