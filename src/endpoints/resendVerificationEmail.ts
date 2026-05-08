import crypto from 'crypto'

import type { Endpoint } from 'payload'

export const resendVerificationEmail: Endpoint = {
  path: '/resend-verification-email',
  method: 'post',
  handler: async (req) => {
    const { payload } = req

    let body: { email?: unknown }
    try {
      const jsonFn = req.json
      if (typeof jsonFn !== 'function') {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }
      body = (await jsonFn.call(req)) as { email?: unknown }
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    // Always return success to prevent email enumeration
    const genericSuccess = Response.json(
      { message: 'If an unverified account exists, a verification email has been sent.' },
      { status: 200 }
    )

    try {
      const result = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      const user = result.docs[0]

      // No user or already verified — silently succeed
      if (!user || user._verified) {
        return genericSuccess
      }

      // Generate a new verification token
      const token = crypto.randomBytes(20).toString('hex')

      // Persist the token
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { _verificationToken: token } as any,
      })

      // Build the verification URL (admin panel verify route)
      const serverURL = payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || ''
      const adminRoute = payload.config.routes?.admin ?? '/admin'
      const verificationURL = `${serverURL}${adminRoute}/users/verify/${token}`

      // Send the verification email
      await payload.email.sendEmail({
        from: `"${payload.email.defaultFromName}" <${payload.email.defaultFromAddress}>`,
        to: user.email as string,
        subject: 'Verify your email address',
        html: `<p>Please verify your email address by clicking the link below:</p><p><a href="${verificationURL}">${verificationURL}</a></p>`,
      })

      return genericSuccess
    } catch (error) {
      payload.logger.error({ err: error }, 'Error in resendVerificationEmail endpoint')
      return genericSuccess
    }
  },
}
