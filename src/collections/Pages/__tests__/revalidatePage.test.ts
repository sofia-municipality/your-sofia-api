jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import { revalidateDelete, revalidatePage } from '../hooks/revalidatePage'

type PageDoc = { slug?: string; _status?: 'draft' | 'published' }

const makeReq = (context: Record<string, unknown> = {}) => ({
  context,
  payload: { logger: { info: jest.fn() } },
})

const runChange = (doc: PageDoc, previousDoc: PageDoc = {}, context?: Record<string, unknown>) =>
  revalidatePage({ doc, previousDoc, req: makeReq(context) } as unknown as Parameters<
    typeof revalidatePage
  >[0])

const runDelete = (doc: PageDoc, context?: Record<string, unknown>) =>
  revalidateDelete({ doc, req: makeReq(context) } as unknown as Parameters<
    typeof revalidateDelete
  >[0])

describe('revalidatePage hook (unit)', () => {
  it('revalidates a published page and the sitemap', () => {
    const doc: PageDoc = { slug: 'about', _status: 'published' }

    expect(runChange(doc)).toBe(doc)
    expect(revalidatePath).toHaveBeenCalledWith('/about')
    expect(revalidateTag).toHaveBeenCalledWith('pages-sitemap', {})
  })

  it('revalidates the root path for the home page', () => {
    runChange({ slug: 'home', _status: 'published' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('revalidates the old path when a page is unpublished', () => {
    runChange({ slug: 'about', _status: 'draft' }, { slug: 'about-us', _status: 'published' })

    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/about-us')
    expect(revalidateTag).toHaveBeenCalledWith('pages-sitemap', {})
  })

  it('does nothing for drafts that were never published', () => {
    runChange({ slug: 'about', _status: 'draft' }, { slug: 'about', _status: 'draft' })

    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('does nothing when revalidation is disabled', () => {
    runChange(
      { slug: 'about', _status: 'draft' },
      { slug: 'about', _status: 'published' },
      { disableRevalidate: true }
    )

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('revalidateDelete hook (unit)', () => {
  it('revalidates the deleted page and the sitemap', () => {
    const doc: PageDoc = { slug: 'about' }

    expect(runDelete(doc)).toBe(doc)
    expect(revalidatePath).toHaveBeenCalledWith('/about')
    expect(revalidateTag).toHaveBeenCalledWith('pages-sitemap', {})
  })

  it('revalidates the root path when the home page is deleted', () => {
    runDelete({ slug: 'home' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('does nothing when revalidation is disabled', () => {
    runDelete({ slug: 'about' }, { disableRevalidate: true })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
