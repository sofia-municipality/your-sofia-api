/**
 * GET /api/subscriptions/mine?token=<ExponentPushToken[...]>
 *
 * Returns the subscription document for the given Expo push token, or null if
 * none exists.  The push token string itself acts as the bearer credential for
 * anonymous devices.
 */
import type { Endpoint } from 'payload'

export const subscriptionMine: Endpoint = {
  path: '/subscriptions/mine',
  method: 'get',
  handler: async (req) => {
    const rawUrl = typeof req.url === 'string' ? req.url : String(req.url)
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl}`)
    const tokenString = url.searchParams.get('token')

    if (!tokenString) {
      return Response.json({ error: 'Missing token query parameter' }, { status: 400 })
    }

    // 1. Find the push-token document by its string value
    const tokenResult = await req.payload.find({
      collection: 'push-tokens',
      where: { token: { equals: tokenString } },
      limit: 1,
    } as any)

    if (tokenResult.totalDocs === 0) {
      return Response.json({ subscription: null }, { status: 200 })
    }

    const pushTokenDoc = tokenResult.docs[0]
    if (!pushTokenDoc) {
      return Response.json({ subscription: null }, { status: 200 })
    }

    // 2. Find the subscription for this push token
    const subResult = await req.payload.find({
      collection: 'subscriptions',
      where: { pushToken: { equals: pushTokenDoc.id } },
      limit: 1,
      depth: 1,
    } as any)

    if (subResult.totalDocs === 0) {
      return Response.json({ subscription: null }, { status: 200 })
    }

    return Response.json({ subscription: subResult.docs[0] }, { status: 200 })
  },
}
