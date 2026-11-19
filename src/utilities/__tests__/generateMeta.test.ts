jest.mock('../getURL', () => ({
  getServerSideURL: () => 'https://api.example.test',
}))

import { generateMeta } from '../generateMeta'

type GenerateMetaDoc = Parameters<typeof generateMeta>[0]['doc']

const run = (doc: Record<string, unknown> | null) =>
  generateMeta({ doc: doc as unknown as GenerateMetaDoc })

const ogImageUrl = async (doc: Record<string, unknown> | null) => {
  const { openGraph } = await run(doc)
  const images = openGraph?.images as Array<{ url: string }>
  return images[0]?.url
}

describe('generateMeta (unit)', () => {
  it('falls back to the default title, image and URL without a document', async () => {
    const meta = await run(null)

    expect(meta.title).toBe('Payload Website Template')
    expect(meta.description).toBeUndefined()
    expect(meta.openGraph).toMatchObject({
      title: 'Payload Website Template',
      description: '',
      url: '/',
      images: [{ url: 'https://api.example.test/website-template-OG.webp' }],
    })
  })

  it('uses the meta title and description', async () => {
    const meta = await run({ meta: { title: 'За нас', description: 'Кои сме ние' } })

    expect(meta.title).toBe('За нас | Payload Website Template')
    expect(meta.description).toBe('Кои сме ние')
    expect(meta.openGraph).toMatchObject({
      title: 'За нас | Payload Website Template',
      description: 'Кои сме ние',
    })
  })

  it('prefers the og-sized image when the meta image is populated', async () => {
    const image = { id: 1, url: '/media/hero.jpg', sizes: { og: { url: '/media/hero-og.jpg' } } }

    await expect(ogImageUrl({ meta: { image } })).resolves.toBe(
      'https://api.example.test/media/hero-og.jpg'
    )
  })

  it('falls back to the original image URL when there is no og size', async () => {
    const image = { id: 1, url: '/media/hero.jpg', sizes: {} }

    await expect(ogImageUrl({ meta: { image } })).resolves.toBe(
      'https://api.example.test/media/hero.jpg'
    )
  })

  it('uses the default image when the meta image is only an id', async () => {
    await expect(ogImageUrl({ meta: { image: 5 } })).resolves.toBe(
      'https://api.example.test/website-template-OG.webp'
    )
  })

  it('joins slug segments into the og URL', async () => {
    const meta = await run({ slug: ['posts', 'my-post'] })

    expect(meta.openGraph?.url).toBe('posts/my-post')
  })
})
