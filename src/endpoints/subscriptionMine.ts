/**
 * GET  /api/subscriptions/mine?token=<ExponentPushToken[...]>
 * PATCH /api/subscriptions/mine?token=<ExponentPushToken[...]>
 *
 * Defined as collection-level endpoints on the Subscriptions collection so they
 * take priority over Payload's auto-generated GET /api/subscriptions/:id route.
 * The push token string acts as the bearer credential for anonymous devices.
 */
import type { Endpoint } from 'payload'

function resolveTokenFromRequest(req: Parameters<Endpoint['handler']>[0]): string | null {
  const rawUrl = typeof req.url === 'string' ? req.url : String(req.url)
  const url = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl}`)
  return url.searchParams.get('token')
}

export const subscriptionMine: Endpoint = {
  path: '/mine',
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
  path: '/mine',
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

    // 3. Parse body
    let body: Record<string, any> = {}
    try {
      body = await req.json()
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // 4. Resolve category slugs → IDs (mobile sends slug strings; Payload needs numeric IDs)
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      const allStrings = body.categories.every((c: unknown) => typeof c === 'string')
      if (allStrings) {
        const catResult = await req.payload.find({
          collection: 'categories',
          where: { slug: { in: body.categories } },
          limit: body.categories.length,
          pagination: false,
        } as any)
        body.categories = catResult.docs.map((doc: { id: number | string }) => doc.id)
      }
    }

    // 5. Upsert — create if no subscription exists yet, otherwise patch
    // depth: 1 ensures categories are returned as populated objects (not raw IDs)
    // so the mobile client can read .slug without an extra fetch.
    if (subResult.totalDocs === 0 || !subResult.docs[0]) {
      const created = await req.payload.create({
        collection: 'subscriptions',
        data: { ...body, pushToken: pushTokenDoc.id },
        depth: 1,
      } as any)
      return Response.json({ doc: created }, { status: 201 })
    }

    const updated = await req.payload.update({
      collection: 'subscriptions',
      id: subResult.docs[0].id,
      data: body,
      depth: 1,
    } as any)

    return Response.json({ doc: updated }, { status: 200 })
  },
}
