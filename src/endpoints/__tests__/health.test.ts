import { healthCheck } from '../health'

describe('health endpoint (unit)', () => {
  it('returns healthy status and expected fields', async () => {
    // Call handler directly with a minimal mock request object
    const mockReq: any = {
      headers: new Map(),
    }

    const res: any = await healthCheck.handler(mockReq)

    // The handler returns a WHATWG Response. Verify status and body.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status', 'healthy')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('environment')
  })
})
