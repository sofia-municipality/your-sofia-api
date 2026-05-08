import { resendVerificationEmail } from '../resendVerificationEmail'

const makeReq = (body: unknown, payloadOverrides: Partial<any> = {}): any => ({
  json: async () => body,
  payload: {
    find: jest.fn(async () => ({ docs: [] })),
    update: jest.fn(async () => ({})),
    email: {
      defaultFromName: 'Sofia',
      defaultFromAddress: 'noreply@sofia.bg',
      sendEmail: jest.fn(async () => {}),
    },
    config: {
      serverURL: 'https://your.sofia.bg',
      routes: { admin: '/admin' },
    },
    logger: { error: jest.fn() },
    ...payloadOverrides,
  },
})

describe('resendVerificationEmail endpoint (unit)', () => {
  it('returns 400 when body is missing email', async () => {
    const req = makeReq({})
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when email is not a string', async () => {
    const req = makeReq({ email: 42 })
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const req: any = {
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
      payload: makeReq({}).payload,
    }
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 when user does not exist (no enumeration)', async () => {
    const req = makeReq({ email: 'unknown@example.com' })
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(200)
    expect(req.payload.email.sendEmail).not.toHaveBeenCalled()
  })

  it('returns 200 when user is already verified (no email sent)', async () => {
    const req = makeReq(
      { email: 'verified@example.com' },
      {
        find: jest.fn(async () => ({
          docs: [{ id: 'u1', email: 'verified@example.com', _verified: true }],
        })),
      }
    )
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(200)
    expect(req.payload.email.sendEmail).not.toHaveBeenCalled()
  })

  it('sends verification email and returns 200 for unverified user', async () => {
    const mockUpdate = jest.fn(async () => ({}))
    const mockSendEmail = jest.fn(async () => {})

    const req = makeReq(
      { email: 'unverified@example.com' },
      {
        find: jest.fn(async () => ({
          docs: [{ id: 'u2', email: 'unverified@example.com', _verified: false }],
        })),
        update: mockUpdate,
        email: {
          defaultFromName: 'Sofia',
          defaultFromAddress: 'noreply@sofia.bg',
          sendEmail: mockSendEmail,
        },
      }
    )

    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(200)

    // Token was persisted
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'u2',
        data: expect.objectContaining({ _verificationToken: expect.any(String) }),
      })
    )

    // Email was sent to correct address
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'unverified@example.com',
        subject: expect.any(String),
        html: expect.stringContaining('/admin/users/verify/'),
      })
    )
  })

  it('normalizes email to lowercase and trims whitespace', async () => {
    const mockFind = jest.fn(async () => ({ docs: [] }))
    const req = makeReq({ email: '  User@Example.COM  ' }, { find: mockFind })
    await resendVerificationEmail.handler(req)
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'user@example.com' } },
      })
    )
  })

  it('returns 200 even when an unexpected error occurs (no info leak)', async () => {
    const req = makeReq(
      { email: 'crash@example.com' },
      {
        find: jest.fn(async () => {
          throw new Error('DB down')
        }),
        logger: { error: jest.fn() },
      }
    )
    const res: any = await resendVerificationEmail.handler(req)
    expect(res.status).toBe(200)
  })
})
