import { beforeSyncWithSearch } from '../beforeSync'

type BeforeSyncArgs = Parameters<typeof beforeSyncWithSearch>[0]

const searchDoc = {
  title: 'Search title',
  priority: 10,
  doc: { relationTo: 'posts', value: '7' },
}

const run = (originalDoc: Record<string, unknown>) =>
  beforeSyncWithSearch({ originalDoc, searchDoc } as unknown as BeforeSyncArgs)

describe('beforeSyncWithSearch (unit)', () => {
  it('copies slug and meta, falling back to the doc title', async () => {
    const result = await run({
      id: '7',
      slug: 'my-post',
      title: 'My post',
      meta: { description: 'About the post', image: { id: 'img-1', url: '/media/a.jpg' } },
    })

    expect(result).toEqual({
      ...searchDoc,
      slug: 'my-post',
      meta: { title: 'My post', image: 'img-1', description: 'About the post' },
      categories: [],
    })
  })

  it('prefers the meta title and keeps an image given as an id', async () => {
    const result = await run({
      id: '7',
      slug: 'my-post',
      title: 'My post',
      meta: { title: 'SEO title', image: 'img-2' },
    })

    expect(result.meta).toEqual({ title: 'SEO title', image: 'img-2', description: undefined })
  })

  it('handles docs without meta', async () => {
    const result = await run({ id: '7', slug: 'my-post', title: 'My post' })

    expect(result.meta).toEqual({ title: 'My post', image: undefined, description: undefined })
  })

  it('flattens populated categories', async () => {
    const result = await run({
      id: '7',
      title: 'My post',
      categories: [
        { id: 1, title: 'Transport', slug: 'transport' },
        { id: 2, title: 'Environment', slug: 'environment' },
      ],
    })

    expect(result.categories).toEqual([
      { relationTo: 'categories', id: 1, title: 'Transport' },
      { relationTo: 'categories', id: 2, title: 'Environment' },
    ])
  })

  it('logs and syncs without categories when a category cannot be read', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await run({ id: '7', title: 'My post', categories: [null] })

    expect(result.categories).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed. Category not found when syncing collection 'posts' with id: '7' to search."
    )
    consoleErrorSpy.mockRestore()
  })
})
