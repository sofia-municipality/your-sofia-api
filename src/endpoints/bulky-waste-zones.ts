import type { Endpoint } from 'payload'

export const bulkyWasteZonesEndpoint: Endpoint = {
  path: '/bulky-waste-zones',
  method: 'get',
  handler: async (req) => {
    const zones = await req.payload.find({
      collection: 'bulky-waste-zones',
      limit: 1000,
    })

    const geoJson = {
      type: 'FeatureCollection',
      features: zones.docs.map((zone) => ({
        type: 'Feature',
        properties: {
          id: zone.id,
          name: zone.name,
          info: zone.info,
          collectionDaysOfWeek: zone.collectionDaysOfWeek ?? [],
        },
        geometry: zone.boundary,
      })),
    }

    return Response.json(geoJson)
  },
}
