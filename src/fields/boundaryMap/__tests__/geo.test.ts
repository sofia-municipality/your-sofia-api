import type { BoundaryGeometry, LatLng } from '../geo'
import { extractPolygon, midpoint, parseBoundaryInput, ringFromValue, valueFromRing } from '../geo'

// GeoJSON stores [lng, lat]; Leaflet works with [lat, lng].
const SQUARE: BoundaryGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [23.3, 42.6],
      [23.4, 42.6],
      [23.4, 42.7],
      [23.3, 42.7],
      [23.3, 42.6],
    ],
  ],
}
const SQUARE_RING: LatLng[] = [
  [42.6, 23.3],
  [42.6, 23.4],
  [42.7, 23.4],
  [42.7, 23.3],
]

describe('ringFromValue (unit)', () => {
  it('converts the outer ring to [lat, lng] and drops the closing point', () => {
    expect(ringFromValue(SQUARE)).toEqual(SQUARE_RING)
  })

  it('keeps the last point when the ring is not closed', () => {
    const open = { type: 'Polygon', coordinates: [SQUARE.coordinates[0]!.slice(0, 4)] }

    expect(ringFromValue(open)).toEqual(SQUARE_RING)
  })

  it('skips malformed coordinates', () => {
    const value = {
      type: 'Polygon',
      coordinates: [[[23.3, 42.6], ['x', 42.6], [23.4], null, [23.4, 42.7]]],
    }

    expect(ringFromValue(value)).toEqual([
      [42.6, 23.3],
      [42.7, 23.4],
    ])
  })

  it.each([
    ['null', null],
    ['a string', 'Polygon'],
    ['a non-polygon geometry', { type: 'Point', coordinates: [23.3, 42.6] }],
    ['a polygon without coordinates', { type: 'Polygon' }],
    ['a polygon without an outer ring', { type: 'Polygon', coordinates: [] }],
  ])('returns an empty ring for %s', (_label, value) => {
    expect(ringFromValue(value)).toEqual([])
  })
})

describe('valueFromRing (unit)', () => {
  it('builds a closed GeoJSON polygon in [lng, lat] order', () => {
    expect(valueFromRing(SQUARE_RING)).toEqual(SQUARE)
  })

  it('returns null for fewer than 3 points', () => {
    expect(valueFromRing(SQUARE_RING.slice(0, 2))).toBeNull()
  })

  it('round-trips with ringFromValue', () => {
    expect(ringFromValue(valueFromRing(SQUARE_RING))).toEqual(SQUARE_RING)
  })
})

describe('extractPolygon (unit)', () => {
  it('accepts a bare polygon geometry', () => {
    expect(extractPolygon(SQUARE)).toEqual(SQUARE)
  })

  it('unwraps a Feature', () => {
    expect(extractPolygon({ type: 'Feature', properties: {}, geometry: SQUARE })).toEqual(SQUARE)
  })

  it('returns the first polygon in a FeatureCollection', () => {
    const other: BoundaryGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    }
    const collection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [23.3, 42.6] } },
        { type: 'Feature', geometry: SQUARE },
        { type: 'Feature', geometry: other },
      ],
    }

    expect(extractPolygon(collection)).toEqual(SQUARE)
  })

  it('rejects polygons whose outer ring has fewer than 3 valid points', () => {
    expect(
      extractPolygon({
        type: 'Polygon',
        coordinates: [
          [
            [23.3, 42.6],
            [23.4, 42.6],
          ],
        ],
      })
    ).toBeNull()
    expect(
      extractPolygon({
        type: 'Polygon',
        coordinates: [
          [
            [23.3, 42.6],
            [23.4, 'x'],
            [23.4, 42.7],
          ],
        ],
      })
    ).toBeNull()
  })

  it.each([
    ['null', null],
    ['a number', 42],
    ['a non-polygon geometry', { type: 'LineString', coordinates: [] }],
    ['an empty FeatureCollection', { type: 'FeatureCollection', features: [] }],
    ['a Feature without geometry', { type: 'Feature' }],
  ])('returns null for %s', (_label, input) => {
    expect(extractPolygon(input)).toBeNull()
  })
})

describe('parseBoundaryInput (unit)', () => {
  it('parses pasted GeoJSON text', () => {
    expect(parseBoundaryInput(JSON.stringify({ type: 'Feature', geometry: SQUARE }))).toEqual(
      SQUARE
    )
  })

  it('returns null for invalid JSON', () => {
    expect(parseBoundaryInput('{ not json')).toBeNull()
  })
})

describe('midpoint (unit)', () => {
  it('returns the point halfway between two coordinates', () => {
    expect(midpoint([42.6, 23.3], [42.7, 23.5])).toEqual([
      expect.closeTo(42.65),
      expect.closeTo(23.4),
    ])
  })
})
