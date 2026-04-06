import { subscriptionMine } from '../subscriptionMine'

const makeReq = (token?: string, overrides: any = {}): any => ({
  url: token
    ? `http://localhost/api/subscriptions/mine?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/subscriptions/mine',
  payload: { find: jest.fn() },
  ...overrides,
})

describe('subscriptionMine endpoint (unit)', () => {
  it('returns 400 when token query param is missing', async () => {
    const req = makeReq(undefined)
    const res: any = await subscriptionMine.handler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns { subscription: null } when push token is not registered', async () => {
    const req = makeReq('ExponentPushToken[abc123]')
    req.payload.find.mockResolvedValue({ totalDocs: 0, docs: [] })
    const res: any = await subscriptionMine.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ subscription: null })
    expect(req.payload.find).toHaveBeenCalledTimes(1)
  })

  it('returns { subscription: null } when token doc exists but no subscription', async () => {
    const req = makeReq('ExponentPushToken[abc123]')
    req.payload.find
      .mockResolvedValueOnce({
        totalDocs: 1,
        docs: [{ id: 42, token: 'ExponentPushToken[abc123]' }],
      })
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })
    const res: any = await subscriptionMine.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ subscription: null })
  })

  it('returns { subscription: doc } when subscription exists', async () => {
    const mockSub = {
      id: 7,
      pushToken: { id: 42, token: 'ExponentPushToken[abc123]' },
      categories: [],
      locationFilters: [],
    }
    const req = makeReq('ExponentPushToken[abc123]')
    req.payload.find
      .mockResolvedValueOnce({
        totalDocs: 1,
        docs: [{ id: 42, token: 'ExponentPushToken[abc123]' }],
      })
      .mockResolvedValueOnce({ totalDocs: 1, docs: [mockSub] })
    const res: any = await subscriptionMine.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ subscription: mockSub })
  })

  it('looks up push-token collection first, then subscriptions', async () => {
    const req = makeReq('ExponentPushToken[xyz]')
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 1, docs: [{ id: 99 }] })
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })
    await subscriptionMine.handler(req)
    expect(req.payload.find.mock.calls[0][0]).toMatchObject({ collection: 'push-tokens' })
    expect(req.payload.find.mock.calls[1][0]).toMatchObject({ collection: 'subscriptions' })
  })

  it('queries subscriptions with depth: 1 for nested docs', async () => {
    const req = makeReq('ExponentPushToken[xyz]')
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 1, docs: [{ id: 99 }] })
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })
    await subscriptionMine.handler(req)
    expect(req.payload.find.mock.calls[1][0]).toMatchObject({ depth: 1 })
  })

  it('handles URL without http prefix (relative URL)', async () => {
    const req = makeReq(undefined)
    req.url = '/api/subscriptions/mine?token=ExponentPushToken%5Btest%5D'
    req.payload.find.mockResolvedValue({ totalDocs: 0, docs: [] })
    const res: any = await subscriptionMine.handler(req)
    expect(res.status).toBe(200)
  })
})
