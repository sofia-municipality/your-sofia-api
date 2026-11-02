import { populateAuthors } from '../hooks/populateAuthors'

type Author = { id: number; name: string; email: string }
type PostDoc = {
  title: string
  authors?: Array<number | { id: number }>
  populatedAuthors?: Array<{ id: number; name: string }>
}

const ana: Author = { id: 1, name: 'Ана', email: 'ana@example.com' }
const boris: Author = { id: 2, name: 'Борис', email: 'boris@example.com' }

const makePayload = (authors: Author[] = [ana, boris]) => ({
  findByID: jest.fn(
    async ({ id }: { id: number }) => authors.find((author) => author.id === id) ?? null
  ),
})

type MockPayload = ReturnType<typeof makePayload>

const runHook = (payload: MockPayload, doc: PostDoc): Promise<PostDoc> =>
  populateAuthors({ doc, req: { payload } } as unknown as Parameters<typeof populateAuthors>[0])

describe('populateAuthors hook (unit)', () => {
  it('leaves posts without authors untouched', async () => {
    for (const authors of [undefined, []]) {
      const payload = makePayload()
      const result = await runHook(payload, { title: 'Post', authors })
      expect(result).not.toHaveProperty('populatedAuthors')
      expect(payload.findByID).not.toHaveBeenCalled()
    }
  })

  it('populates only the id and name of each author', async () => {
    const payload = makePayload()

    const result = await runHook(payload, { title: 'Post', authors: [1, { id: 2 }] })

    expect(result.populatedAuthors).toEqual([
      { id: 1, name: 'Ана' },
      { id: 2, name: 'Борис' },
    ])
    expect(payload.findByID).toHaveBeenCalledWith({ id: 1, collection: 'users', depth: 0 })
    expect(payload.findByID).toHaveBeenCalledWith({ id: 2, collection: 'users', depth: 0 })
  })

  it('skips authors that no longer exist', async () => {
    const result = await runHook(makePayload([boris]), { title: 'Post', authors: [1, 2] })
    expect(result.populatedAuthors).toEqual([{ id: 2, name: 'Борис' }])
  })

  it('skips authors whose lookup fails', async () => {
    const payload = makePayload()
    payload.findByID.mockRejectedValueOnce(new Error('db down'))

    const result = await runHook(payload, { title: 'Post', authors: [1, 2] })

    expect(result.populatedAuthors).toEqual([{ id: 2, name: 'Борис' }])
  })
})
