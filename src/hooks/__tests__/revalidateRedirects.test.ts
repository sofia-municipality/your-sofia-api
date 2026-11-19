jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

import { revalidateTag } from 'next/cache'
import { revalidateRedirects } from '../revalidateRedirects'

describe('revalidateRedirects hook (unit)', () => {
  it('revalidates the redirects cache tag and returns the doc', () => {
    const doc = { id: 1, from: '/old', to: { url: '/new' } }
    const payload = { logger: { info: jest.fn() } }

    const result = revalidateRedirects({ doc, req: { payload } } as unknown as Parameters<
      typeof revalidateRedirects
    >[0])

    expect(result).toBe(doc)
    expect(revalidateTag).toHaveBeenCalledWith('redirects', {})
    expect(payload.logger.info).toHaveBeenCalledWith('Revalidating redirects')
  })
})
