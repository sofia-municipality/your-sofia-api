import type { PayloadRequest } from 'payload'
import { bulkyWasteZonesEndpoint } from '../bulky-waste-zones'

const boundary = {
  type: 'Polygon',
  coordinates: [
    [
      [23.3, 42.7],
      [23.4, 42.7],
      [23.4, 42.8],
      [23.3, 42.7],
    ],
  ],
}

type ZoneDoc = {
  id: number
  name: string
  info?: string
  collectionDaysOfWeek?: string[] | null
  boundary: typeof boundary
}
type FeatureCollectionBody = {
  features: Array<{ properties: { collectionDaysOfWeek: string[] } }>
}

const makePayload = (docs: ZoneDoc[]) => ({ find: jest.fn(async () => ({ docs })) })

type MockPayload = ReturnType<typeof makePayload>

const makeReq = (payload: MockPayload) => ({ payload }) as unknown as PayloadRequest

describe('bulkyWasteZones endpoint (unit)', () => {
  it('returns zones as a GeoJSON FeatureCollection', async () => {
    const payload = makePayload([
      {
        id: 1,
        name: 'Zone 1',
        info: 'First Monday of the month',
        collectionDaysOfWeek: ['monday'],
        boundary,
      },
    ])

    const res = await bulkyWasteZonesEndpoint.handler(makeReq(payload))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 1,
            name: 'Zone 1',
            info: 'First Monday of the month',
            collectionDaysOfWeek: ['monday'],
          },
          geometry: boundary,
        },
      ],
    })
    expect(payload.find).toHaveBeenCalledWith({ collection: 'bulky-waste-zones', limit: 1000 })
  })

  it('defaults missing collection days to an empty array', async () => {
    const payload = makePayload([
      { id: 1, name: 'Zone 1', boundary, collectionDaysOfWeek: null },
      { id: 2, name: 'Zone 2', boundary },
    ])

    const res = await bulkyWasteZonesEndpoint.handler(makeReq(payload))

    const body: FeatureCollectionBody = await res.json()
    expect(body.features.map((f) => f.properties.collectionDaysOfWeek)).toEqual([[], []])
  })

  it('returns an empty FeatureCollection when there are no zones', async () => {
    const res = await bulkyWasteZonesEndpoint.handler(makeReq(makePayload([])))

    expect(await res.json()).toEqual({ type: 'FeatureCollection', features: [] })
  })
})
