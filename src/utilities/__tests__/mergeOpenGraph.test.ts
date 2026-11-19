jest.mock('../getURL', () => ({
  getServerSideURL: () => 'https://api.example.test',
}))

import { mergeOpenGraph } from '../mergeOpenGraph'

const DEFAULT_IMAGES = [{ url: 'https://api.example.test/website-template-OG.webp' }]

describe('mergeOpenGraph (unit)', () => {
  it('returns the defaults when nothing is provided', () => {
    expect(mergeOpenGraph()).toEqual({
      type: 'website',
      description: 'An open-source website built with Payload and Next.js.',
      images: DEFAULT_IMAGES,
      siteName: 'Payload Website Template',
      title: 'Payload Website Template',
    })
  })

  it('overrides defaults with the provided fields', () => {
    expect(mergeOpenGraph({ title: 'Твоята София', description: 'Новини' })).toMatchObject({
      type: 'website',
      siteName: 'Payload Website Template',
      title: 'Твоята София',
      description: 'Новини',
      images: DEFAULT_IMAGES,
    })
  })

  it('uses the provided images instead of the default image', () => {
    const images = [{ url: 'https://cdn.example.test/og.jpg' }]

    expect(mergeOpenGraph({ images })?.images).toBe(images)
  })
})
