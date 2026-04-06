/**
 * GET  /api/subscriptions/mine?token=<ExponentPushToken[...]>
 * PATCH /api/subscriptions/mine?token=<ExponentPushToken[...]>
 *
 * The push token string acts as the bearer credential for anonymous devices.
 * Authenticated users should continue to use the standard Payload REST API
 * (PATCH /api/subscriptions/:id with JWT) — that path is also preserved.
 */
import type { Endpoint } from 'payload'

function resolveTokenFromRequest(req: Parameters<Endpoint['handler']>[0]): string | null {
  const rawUrl = typeof req.url === 'string' ? req.url : String(req.url)
  const url = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl}`)
  return url.searchParams.get('token')
}

export const subscriptionMine: Endpoint = {
  path: '/subscriptions/mine',
  method: 'get',
  handler: async (req) => {
    const tokenString = resolveTokenFromRequest(req)

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

export const subscriptionMinePatch: Endpoint = {
  path: '/subscriptions/mine',
  method: 'patch',
  handler: async (req) => {
    const tokenString = resolveTokenFromRequest(req)

    if (!tokenString) {
      return Response.json({ error: 'Missing token query parameter' }, { status: 400 })
    }

    // 1. Verify the push token exists
    const tokenResult = await req.payload.find({
      collection: 'push-tokens',
      where: { token: { equals: tokenString } },
      limit: 1,
    } as any)

    if (tokenResult.totalDocs === 0 || !tokenResult.docs[0]) {
      return Response.json({ error: 'Push token not found' }, { status: 404 })
    }

    const pushTokenDoc = tokenResult.docs[0]

    // 2. Find the subscription owned by this push token
    const subResult = await req.payload.find({
      collection: 'subscriptions',
      where: { pushToken: { equals: pushTokenDoc.id } },
      limit: 1,
    } as any)

    if (subResult.totalDocs === 0 || !subResult.docs[0]) {
      return Response.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const subId = subResult.docs[0].id

    // 3. Parse body and apply update via the local Payload API (bypasses REST access control)
    const body = req.json ? await req.json() : {}

    const updated = await req.payload.update({
      collection: 'subscriptions',
      id: subId,
      data: body,
    } as any)

    return Response.json({ doc: updated }, { status: 200 })
  },
}
