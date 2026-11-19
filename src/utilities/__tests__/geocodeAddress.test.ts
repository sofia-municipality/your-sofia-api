import type { BasePayload } from 'payload'
import { geocodeAddress, normalizeAddress, sleep, transliterate } from '../geocodeAddress'

type CachedDoc = { address: string; districtHint: string; location?: [number, number] | null }
type CreateArgs = { collection: string; data: Record<string, unknown>; overrideAccess: boolean }

const makePayload = (cached: CachedDoc[] = []) => ({
  find: jest.fn(async (_args: unknown) => ({ docs: cached })),
  create: jest.fn(async (_args: CreateArgs) => ({})),
})

type MockPayload = ReturnType<typeof makePayload>

const asPayload = (payload: MockPayload) => payload as unknown as BasePayload

const fetchMock = () => global.fetch as jest.MockedFunction<typeof fetch>

const respondWith = (body: unknown, status = 200) =>
  fetchMock().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  )

const requestedUrl = (): URL => {
  const [call] = fetchMock().mock.calls
  if (!call) throw new Error('Expected Nominatim to have been called')
  return new URL(String(call[0]))
}

describe('transliterate', () => {
  it('maps the Bulgarian alphabet using the official streamlined system', () => {
    expect(transliterate('АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ')).toBe(
      'ABVGDEZhZIYKLMNOPRSTUFHTsChShShtAYYuYa'
    )
    expect(transliterate('абвгдежзийклмнопрстуфхцчшщъьюя')).toBe(
      'abvgdezhziyklmnoprstufhtschshshtayyuya'
    )
  })

  it('transliterates street names', () => {
    expect(transliterate('Цар Симеон')).toBe('Tsar Simeon')
    expect(transliterate('Опълченска')).toBe('Opalchenska')
    expect(transliterate('Жолио-Кюри')).toBe('Zholio-Kyuri')
  })

  it('leaves digits, punctuation and Latin characters unchanged', () => {
    expect(transliterate('бл. 12-А, Sofia №3')).toBe('bl. 12-A, Sofia №3')
    expect(transliterate('')).toBe('')
  })
})

describe('normalizeAddress', () => {
  it.each([
    ['ул. Витоша 5, вх. А', 'ул. Витоша 5'],
    ['бл. 12 вх.Б ет. 3', 'бл. 12'],
    ['ул. Пиротска 1, ВХ. 2', 'ул. Пиротска 1'],
  ])('removes the entrance suffix from %p', (raw, expected) => {
    expect(normalizeAddress(raw)).toBe(expected)
  })

  it('removes parenthetical notes', () => {
    expect(normalizeAddress('ул. Пиротска 10 (до магазина) (двор)')).toBe('ул. Пиротска 10')
  })

  it('removes number signs and collapses whitespace', () => {
    expect(normalizeAddress('  бул.   Витоша   № 5 ')).toBe('бул. Витоша 5')
    expect(normalizeAddress('ул. Граф Игнатиев #15')).toBe('ул. Граф Игнатиев 15')
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeAddress('   ')).toBe('')
  })
})

describe('geocodeAddress', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns cached coordinates without calling Nominatim', async () => {
    const payload = makePayload([
      { address: 'ул. Витоша 5', districtHint: 'ТРИАДИЦА', location: [23.32, 42.69] },
    ])

    await expect(
      geocodeAddress('ул. Витоша № 5, вх. А', 'ТРИАДИЦА', asPayload(payload))
    ).resolves.toEqual({ lat: 42.69, lng: 23.32 })

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'geocode-addresses',
      where: {
        and: [{ address: { equals: 'ул. Витоша 5' } }, { districtHint: { equals: 'ТРИАДИЦА' } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it.each([null, undefined])(
    'treats a cached entry with location %p as a confirmed miss',
    async (location) => {
      const payload = makePayload([{ address: 'ул. Никоя 1', districtHint: 'Sofia', location }])

      await expect(geocodeAddress('ул. Никоя 1', 'Sofia', asPayload(payload))).resolves.toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
      expect(payload.create).not.toHaveBeenCalled()
    }
  )

  it('queries Nominatim with the transliterated street and caches the first hit', async () => {
    const payload = makePayload()
    respondWith([
      { lat: '42.6977', lon: '23.3219' },
      { lat: '42.1', lon: '23.1' },
    ])

    await expect(
      geocodeAddress('ул. Цар Симеон № 15, вх. Б', undefined, asPayload(payload))
    ).resolves.toEqual({ lat: 42.6977, lng: 23.3219 })

    const url = requestedUrl()
    expect(`${url.origin}${url.pathname}`).toBe('https://nominatim.openstreetmap.org/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      street: 'Tsar Simeon 15',
      city: 'Sofia',
      country: 'bg',
      format: 'json',
      limit: '5',
    })
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), {
      headers: { 'User-Agent': expect.stringContaining('YourSofia') },
      signal: expect.any(AbortSignal),
    })
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'geocode-addresses',
      data: {
        address: 'ул. Цар Симеон 15',
        districtHint: 'Sofia',
        location: [23.3219, 42.6977],
      },
      overrideAccess: true,
    })
  })

  it.each([
    ['ВЪЗРАЖДАНЕ', 'Възраждане'],
    ['КРАСНА ПОЛЯНА', 'Красна Поляна'],
  ])('narrows the search to district %p as a title-cased county', async (district, county) => {
    respondWith([])

    await geocodeAddress('ул. Опълченска 3', district, asPayload(makePayload()))

    expect(requestedUrl().searchParams.get('county')).toBe(county)
  })

  it.each(['Sofia', ''])('does not send a county for district hint %p', async (district) => {
    respondWith([])

    await geocodeAddress('ул. Опълченска 3', district, asPayload(makePayload()))

    expect(requestedUrl().searchParams.has('county')).toBe(false)
  })

  it.each([
    ['ул.Витоша 1', 'Vitosha 1'],
    ['УЛ. Витоша 1', 'Vitosha 1'],
    ['бул. Христо Ботев 48', 'Hristo Botev 48'],
    ['пл. Славейков 4', 'Slaveykov 4'],
    ['кв. Лозенец', 'Lozenets'],
    ['ж.к. Люлин 5', 'Lyulin 5'],
    ['жк Младост 1', 'Mladost 1'],
    ['Бурел с ул. Стефан Сарафов', 'Burel'],
    ['бул. Княз Борис I ъгъла с бул. Скобелев', 'Knyaz Boris I'],
    ['ул. Витоша ъгъл ул. Патриарх Евтимий', 'Vitosha'],
    ['ул. Опълченска срещу бл. 5', 'Opalchenska'],
    ['ул. Пиротска до бл. 12', 'Pirotska'],
    ['ул. Пиротска на паркинга', 'Pirotska'],
  ])('reduces %p to the street name %p before querying', async (raw, street) => {
    respondWith([])

    await geocodeAddress(raw, 'Sofia', asPayload(makePayload()))

    expect(requestedUrl().searchParams.get('street')).toBe(street)
  })

  // BUG (bugs.md #8): a failed cache write lands in the same catch as network errors, so the
  // point Nominatim found is thrown away.
  it.failing('returns the coordinates even when caching them fails', async () => {
    const payload = makePayload()
    payload.create.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint')
    )
    respondWith([{ lat: '42.6977', lon: '23.3219' }])

    await expect(geocodeAddress('ул. Витоша 5', 'ТРИАДИЦА', asPayload(payload))).resolves.toEqual({
      lat: 42.6977,
      lng: 23.3219,
    })
  })

  it('caches a miss when Nominatim finds nothing', async () => {
    const payload = makePayload()
    respondWith([])

    await expect(geocodeAddress('ул. Никоя 1', 'Sofia', asPayload(payload))).resolves.toBeNull()

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'geocode-addresses',
      data: { address: 'ул. Никоя 1', districtHint: 'Sofia' },
      overrideAccess: true,
    })
  })

  it('never stores non-numeric coordinates', async () => {
    const payload = makePayload()
    respondWith([{ lat: 'n/a', lon: '23.3' }])

    await expect(geocodeAddress('ул. Никоя 1', 'Sofia', asPayload(payload))).resolves.toBeNull()

    const [call] = payload.create.mock.calls
    expect(call?.[0].data).not.toHaveProperty('location')
  })

  it('does not cache HTTP errors so the address is retried later', async () => {
    const payload = makePayload()
    respondWith({ error: 'rate limited' }, 429)

    await expect(geocodeAddress('ул. Витоша 5', 'Sofia', asPayload(payload))).resolves.toBeNull()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('does not cache network failures', async () => {
    const payload = makePayload()
    fetchMock().mockRejectedValue(new TypeError('fetch failed'))

    await expect(geocodeAddress('ул. Витоша 5', 'Sofia', asPayload(payload))).resolves.toBeNull()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('does not cache malformed JSON responses', async () => {
    const payload = makePayload()
    respondWith('<html>Service unavailable</html>')

    await expect(geocodeAddress('ул. Витоша 5', 'Sofia', asPayload(payload))).resolves.toBeNull()
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe('sleep', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves only after the given delay', async () => {
    jest.useFakeTimers()
    let resolved = false
    void sleep(1000).then(() => {
      resolved = true
    })

    await jest.advanceTimersByTimeAsync(999)
    expect(resolved).toBe(false)

    await jest.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })
})
