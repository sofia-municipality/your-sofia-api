import { deleteAccount } from '../deleteAccount'

describe('deleteAccount endpoint (unit)', () => {
  it('returns 401 when unauthenticated', async () => {
    const mockReq: any = { payload: {}, user: null }
    const res: any = await deleteAccount.handler(mockReq)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 403 when user is admin', async () => {
    const mockPayload: any = {
      findByID: jest.fn(async () => ({ id: 'u1', role: 'admin' })),
      update: jest.fn(),
    }
    const mockReq: any = { payload: mockPayload, user: { id: 'u1' } }
    const res: any = await deleteAccount.handler(mockReq)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('anonymizes and updates user on success', async () => {
    const mockUserDoc = { id: 'u2', role: 'user' }
    const mockPayload: any = {
      findByID: jest.fn(async () => mockUserDoc),
      update: jest.fn(async () => ({ id: 'u2' })),
    }
    const mockReq: any = { payload: mockPayload, user: { id: 'u2' } }
    const res: any = await deleteAccount.handler(mockReq)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', id: 'u2' }))
  })
})
