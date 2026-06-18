import {
  docToUpdateMessage,
  hasNullPinTimespanStart,
  messageInBounds,
  messageMatchesCategories,
  sortByRelevance,
  type UpdateMessage,
  type ViewportBounds,
} from '../oboMessageMapper'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'doc-1',
    text: 'Test update',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    crawledAt: new Date('2026-01-01T01:00:00.000Z'),
    finalizedAt: new Date('2026-01-01T02:00:00.000Z'),
    timespanStart: new Date('2026-01-01T00:00:00.000Z'),
    timespanEnd: new Date('2026-01-10T00:00:00.000Z'),
    locality: 'bg.sofia',
    ...overrides,
  }
}

function makeMsg(overrides: Partial<UpdateMessage> = {}): UpdateMessage {
  return {
    text: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const SOFIA_BOUNDS: ViewportBounds = { north: 42.8, south: 42.6, east: 23.5, west: 23.2 }

// ─── docToUpdateMessage ───────────────────────────────────────────────────

describe('docToUpdateMessage', () => {
  describe('basic mapping', () => {
    it('maps a minimal valid doc', () => {
      const result = docToUpdateMessage({
        text: 'Hello',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
      expect(result).not.toBeNull()
      expect(result!.text).toBe('Hello')
      expect(result!.createdAt).toBe('2026-01-01T00:00:00.000Z')
    })

    it('maps a full document correctly', () => {
      const doc = makeDoc({
        source: 'sofia-water',
        sourceUrl: 'https://example.com',
        locality: 'bg.sofia',
        markdownText: '**bold**',
        plainText: 'bold',
        responsibleEntity: 'Water Dept',
        cityWide: true,
        categories: ['water', 'infrastructure'],
        busStops: ['Stop A', 'Stop B'],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.source).toBe('sofia-water')
      expect(result.sourceUrl).toBe('https://example.com')
      expect(result.locality).toBe('bg.sofia')
      expect(result.markdownText).toBe('**bold**')
      expect(result.plainText).toBe('bold')
      expect(result.responsibleEntity).toBe('Water Dept')
      expect(result.cityWide).toBe(true)
      expect(result.categories).toEqual(['water', 'infrastructure'])
      expect(result.busStops).toEqual(['Stop A', 'Stop B'])
    })

    it('defaults text to empty string when missing', () => {
      const result = docToUpdateMessage({ createdAt: new Date() })!
      expect(result.text).toBe('')
    })

    it('falls back createdAt to now when missing', () => {
      const before = new Date()
      const result = docToUpdateMessage({})!
      const after = new Date()
      const parsed = new Date(result.createdAt)
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('cityWide is false when not explicitly true', () => {
      expect(docToUpdateMessage(makeDoc({ cityWide: false }))!.cityWide).toBe(false)
      expect(docToUpdateMessage(makeDoc({ cityWide: undefined }))!.cityWide).toBe(false)
      expect(docToUpdateMessage(makeDoc({ cityWide: 'yes' }))!.cityWide).toBe(false)
    })
  })

  describe('id handling', () => {
    it('uses string _id directly', () => {
      const result = docToUpdateMessage(makeDoc({ _id: 'abc-123' }))!
      expect(result.id).toBe('abc-123')
    })

    it('converts object _id via toString', () => {
      const result = docToUpdateMessage(makeDoc({ _id: { toString: () => 'object-id-value' } }))!
      expect(result.id).toBe('object-id-value')
    })

    it('leaves id undefined when _id is missing', () => {
      const result = docToUpdateMessage(makeDoc({ _id: undefined }))!
      expect(result.id).toBeUndefined()
    })
  })

  describe('date handling', () => {
    it('converts Date objects to ISO strings', () => {
      const d = new Date('2026-03-15T12:00:00.000Z')
      const result = docToUpdateMessage(makeDoc({ crawledAt: d, finalizedAt: d }))!
      expect(result.crawledAt).toBe('2026-03-15T12:00:00.000Z')
      expect(result.finalizedAt).toBe('2026-03-15T12:00:00.000Z')
    })

    it('passes through ISO string dates unchanged', () => {
      const result = docToUpdateMessage(makeDoc({ crawledAt: '2026-03-15T12:00:00.000Z' }))!
      expect(result.crawledAt).toBe('2026-03-15T12:00:00.000Z')
    })

    it('handles Firestore Timestamp shape (toDate method)', () => {
      const firestoreTs = { toDate: () => new Date('2026-04-01T00:00:00.000Z') }
      const result = docToUpdateMessage(makeDoc({ crawledAt: firestoreTs }))!
      expect(result.crawledAt).toBe('2026-04-01T00:00:00.000Z')
    })

    it('returns undefined for invalid date values', () => {
      const result = docToUpdateMessage(makeDoc({ crawledAt: 12345 }))!
      expect(result.crawledAt).toBeUndefined()
    })
  })

  describe('timespan fallback rules', () => {
    it('uses explicit timespanStart and timespanEnd when present', () => {
      const doc = makeDoc({
        timespanStart: new Date('2026-02-01T00:00:00.000Z'),
        timespanEnd: new Date('2026-02-28T00:00:00.000Z'),
      })
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-02-01T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-02-28T00:00:00.000Z')
    })

    it('mirrors timespanEnd to timespanStart when only end is present', () => {
      const doc = makeDoc({
        timespanStart: undefined,
        timespanEnd: new Date('2026-02-28T00:00:00.000Z'),
      })
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-02-28T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-02-28T00:00:00.000Z')
    })

    it('mirrors timespanStart to timespanEnd when only start is present', () => {
      const doc = makeDoc({
        timespanStart: new Date('2026-02-01T00:00:00.000Z'),
        timespanEnd: undefined,
      })
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-02-01T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-02-01T00:00:00.000Z')
    })

    it('falls back to finalizedAt when both timespan fields are absent', () => {
      const doc = makeDoc({
        timespanStart: undefined,
        timespanEnd: undefined,
        finalizedAt: new Date('2026-01-05T00:00:00.000Z'),
      })
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-01-05T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-01-05T00:00:00.000Z')
    })

    it('falls back to crawledAt when finalizedAt is also absent', () => {
      const doc = makeDoc({
        timespanStart: undefined,
        timespanEnd: undefined,
        finalizedAt: undefined,
        crawledAt: new Date('2026-01-03T00:00:00.000Z'),
      })
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-01-03T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-01-03T00:00:00.000Z')
    })

    it('falls back to createdAt as last resort', () => {
      const doc = {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }
      const result = docToUpdateMessage(doc)!
      expect(result.timespanStart).toBe('2026-01-01T00:00:00.000Z')
      expect(result.timespanEnd).toBe('2026-01-01T00:00:00.000Z')
    })
  })

  describe('geoJson parsing', () => {
    const validFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [23.32, 42.7] },
          properties: { name: 'Sofia' },
        },
      ],
    }

    it('accepts an object geoJson directly', () => {
      const result = docToUpdateMessage(makeDoc({ geoJson: validFeatureCollection }))!
      expect(result.geoJson).toEqual(validFeatureCollection)
    })

    it('parses geoJson stored as a stringified JSON string', () => {
      const result = docToUpdateMessage(
        makeDoc({ geoJson: JSON.stringify(validFeatureCollection) })
      )!
      expect(result.geoJson).toEqual(validFeatureCollection)
    })

    it('returns undefined geoJson when the string is malformed JSON', () => {
      const result = docToUpdateMessage(makeDoc({ geoJson: '{invalid json' }))!
      expect(result.geoJson).toBeUndefined()
    })

    it('returns undefined geoJson when type is not FeatureCollection', () => {
      const result = docToUpdateMessage(makeDoc({ geoJson: { type: 'Feature', geometry: {} } }))!
      expect(result.geoJson).toBeUndefined()
    })

    it('filters out features with no geometry', () => {
      const fc = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: null },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [23.32, 42.7] } },
        ],
      }
      const result = docToUpdateMessage(makeDoc({ geoJson: fc }))!
      expect(result.geoJson!.features).toHaveLength(1)
    })
  })

  describe('pins', () => {
    it('maps pins with coordinates and timespans', () => {
      const doc = makeDoc({
        pins: [
          {
            address: 'ul. Vitosha 1',
            coordinates: { lat: 42.7, lng: 23.32 },
            timespans: [{ start: '2026-01-01T00:00:00.000Z', end: '2026-01-10T00:00:00.000Z' }],
          },
        ],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.pins).toHaveLength(1)
      expect(result.pins![0].address).toBe('ul. Vitosha 1')
      expect(result.pins![0].coordinates).toEqual({ lat: 42.7, lng: 23.32 })
      expect(result.pins![0].timespans[0]).toEqual({
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-10T00:00:00.000Z',
      })
    })

    it('drops pins without an address', () => {
      const doc = makeDoc({
        pins: [{ coordinates: { lat: 42.7, lng: 23.32 }, timespans: [] }],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.pins).toHaveLength(0)
    })

    it('converts Date timespans in pins', () => {
      const doc = makeDoc({
        pins: [
          {
            address: 'ul. Test 1',
            timespans: [{ start: new Date('2026-01-01T00:00:00.000Z'), end: null }],
          },
        ],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.pins![0].timespans[0].start).toBe('2026-01-01T00:00:00.000Z')
      expect(result.pins![0].timespans[0].end).toBeNull()
    })
  })

  describe('streets', () => {
    it('maps streets correctly', () => {
      const doc = makeDoc({
        streets: [
          {
            street: 'ul. Vitosha',
            from: 'ул. Граф Игнатиев',
            fromCoordinates: { lat: 42.69, lng: 23.32 },
            to: 'пл. България',
            toCoordinates: { lat: 42.7, lng: 23.32 },
            timespans: [],
          },
        ],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.streets).toHaveLength(1)
      expect(result.streets![0].street).toBe('ul. Vitosha')
    })

    it('drops streets missing required string fields', () => {
      const doc = makeDoc({
        streets: [{ street: 'ul. Test', from: 'A' }], // missing 'to'
      })
      const result = docToUpdateMessage(doc)!
      expect(result.streets).toHaveLength(0)
    })
  })

  describe('cadastral properties', () => {
    it('maps cadastral properties', () => {
      const doc = makeDoc({
        cadastralProperties: [
          { identifier: '68134.407.37', timespans: [{ start: null, end: null }] },
        ],
      })
      const result = docToUpdateMessage(doc)!
      expect(result.cadastralProperties).toHaveLength(1)
      expect(result.cadastralProperties![0].identifier).toBe('68134.407.37')
    })

    it('drops entries without an identifier', () => {
      const doc = makeDoc({ cadastralProperties: [{ timespans: [] }] })
      const result = docToUpdateMessage(doc)!
      expect(result.cadastralProperties).toHaveLength(0)
    })
  })

  describe('error resilience', () => {
    it('returns null when an unrecoverable error is thrown', () => {
      const circular: Record<string, unknown> = {}
      Object.defineProperty(circular, 'text', {
        get() {
          throw new Error('boom')
        },
        enumerable: true,
      })
      expect(docToUpdateMessage(circular)).toBeNull()
    })
  })
})

// ─── hasNullPinTimespanStart ──────────────────────────────────────────────

describe('hasNullPinTimespanStart', () => {
  it('returns false when there are no pins', () => {
    expect(hasNullPinTimespanStart(makeMsg())).toBe(false)
  })

  it('returns false when all pin timespans have a start', () => {
    const msg = makeMsg({
      pins: [{ address: 'A', timespans: [{ start: '2026-01-01T00:00:00.000Z', end: null }] }],
    })
    expect(hasNullPinTimespanStart(msg)).toBe(false)
  })

  it('returns true when any pin timespan has a null start', () => {
    const msg = makeMsg({
      pins: [{ address: 'A', timespans: [{ start: null, end: null }] }],
    })
    expect(hasNullPinTimespanStart(msg)).toBe(true)
  })

  it('returns true when one pin has null start among mixed pins', () => {
    const msg = makeMsg({
      pins: [
        { address: 'A', timespans: [{ start: '2026-01-01T00:00:00.000Z', end: null }] },
        { address: 'B', timespans: [{ start: null, end: null }] },
      ],
    })
    expect(hasNullPinTimespanStart(msg)).toBe(true)
  })
})

// ─── messageInBounds ──────────────────────────────────────────────────────

describe('messageInBounds', () => {
  it('always returns true for cityWide messages', () => {
    const msg = makeMsg({ cityWide: true })
    const outsideBounds: ViewportBounds = { north: 10, south: 9, east: 10, west: 9 }
    expect(messageInBounds(msg, outsideBounds)).toBe(true)
  })

  it('returns true when message has no geometry (informational)', () => {
    expect(messageInBounds(makeMsg(), SOFIA_BOUNDS)).toBe(true)
  })

  it('returns true for a Point feature inside bounds', () => {
    const msg = makeMsg({
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [23.32, 42.7] },
            properties: {},
          },
        ],
      },
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(true)
  })

  it('returns false for a Point feature outside bounds', () => {
    const msg = makeMsg({
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [24.0, 43.0] },
            properties: {},
          },
        ],
      },
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(false)
  })

  it('returns true for a LineString whose centroid is inside bounds', () => {
    const msg = makeMsg({
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [23.3, 42.69],
                [23.34, 42.71],
              ],
            },
          },
        ],
      },
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(true)
  })

  it('returns true for a Polygon whose centroid is inside bounds', () => {
    const msg = makeMsg({
      geoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [23.3, 42.69],
                  [23.34, 42.69],
                  [23.34, 42.71],
                  [23.3, 42.71],
                  [23.3, 42.69],
                ],
              ],
            },
          },
        ],
      },
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(true)
  })

  it('returns true when a pin coordinate is inside bounds', () => {
    const msg = makeMsg({
      pins: [{ address: 'A', coordinates: { lat: 42.7, lng: 23.32 }, timespans: [] }],
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(true)
  })

  it('returns false when pin coordinates are outside bounds', () => {
    const msg = makeMsg({
      pins: [{ address: 'A', coordinates: { lat: 43.0, lng: 24.0 }, timespans: [] }],
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(false)
  })

  it('returns true when no geometry present even if pins have no coordinates', () => {
    const msg = makeMsg({
      pins: [{ address: 'A', timespans: [] }],
    })
    expect(messageInBounds(msg, SOFIA_BOUNDS)).toBe(true)
  })
})

// ─── sortByRelevance ──────────────────────────────────────────────────────

describe('sortByRelevance', () => {
  it('sorts by finalizedAt descending', () => {
    const msgs = [
      makeMsg({ finalizedAt: '2026-01-01T00:00:00.000Z' }),
      makeMsg({ finalizedAt: '2026-01-03T00:00:00.000Z' }),
      makeMsg({ finalizedAt: '2026-01-02T00:00:00.000Z' }),
    ]
    const sorted = sortByRelevance(msgs)
    expect(sorted[0].finalizedAt).toBe('2026-01-03T00:00:00.000Z')
    expect(sorted[1].finalizedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(sorted[2].finalizedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('uses timespanEnd as tiebreaker when finalizedAt is equal', () => {
    const msgs = [
      makeMsg({ finalizedAt: '2026-01-01T00:00:00.000Z', timespanEnd: '2026-01-05T00:00:00.000Z' }),
      makeMsg({ finalizedAt: '2026-01-01T00:00:00.000Z', timespanEnd: '2026-01-10T00:00:00.000Z' }),
    ]
    const sorted = sortByRelevance(msgs)
    expect(sorted[0].timespanEnd).toBe('2026-01-10T00:00:00.000Z')
  })

  it('sorts messages with no finalizedAt last', () => {
    const msgs = [
      makeMsg({ finalizedAt: undefined }),
      makeMsg({ finalizedAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const sorted = sortByRelevance(msgs)
    expect(sorted[0].finalizedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(sorted[1].finalizedAt).toBeUndefined()
  })

  it('does not mutate the original array', () => {
    const msgs = [
      makeMsg({ finalizedAt: '2026-01-02T00:00:00.000Z' }),
      makeMsg({ finalizedAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const original = [...msgs]
    sortByRelevance(msgs)
    expect(msgs).toEqual(original)
  })
})

// ─── docToUpdateMessage id source (REST vs Mongo) ──────────────────────────

describe('docToUpdateMessage id resolution', () => {
  it('prefers a REST-style string `id`', () => {
    const result = docToUpdateMessage(makeDoc({ id: 'rest-id', _id: 'mongo-id' }))!
    expect(result.id).toBe('rest-id')
  })

  it('falls back to Mongo `_id` when `id` is absent', () => {
    const doc = makeDoc()
    delete (doc as Record<string, unknown>).id
    const result = docToUpdateMessage(doc)!
    expect(result.id).toBe('doc-1')
  })
})

// ─── messageMatchesCategories ──────────────────────────────────────────────

describe('messageMatchesCategories', () => {
  it('matches everything when the filter is null or empty', () => {
    expect(messageMatchesCategories(makeMsg({ categories: ['water'] }), null)).toBe(true)
    expect(messageMatchesCategories(makeMsg({ categories: ['water'] }), [])).toBe(true)
  })

  it('matches when a category overlaps (case-insensitive)', () => {
    expect(messageMatchesCategories(makeMsg({ categories: ['Water'] }), ['water'])).toBe(true)
    expect(messageMatchesCategories(makeMsg({ categories: ['traffic'] }), ['water'])).toBe(false)
  })

  it('always matches cityWide messages regardless of category', () => {
    expect(
      messageMatchesCategories(makeMsg({ categories: ['traffic'], cityWide: true }), ['water'])
    ).toBe(true)
  })

  it('does not match a non-cityWide message with no categories', () => {
    expect(messageMatchesCategories(makeMsg({ categories: [] }), ['water'])).toBe(false)
  })
})
