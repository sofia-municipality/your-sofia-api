import type { BasePayload } from 'payload'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'YourSofia/1.0 (sofia-municipality@sofia.bg)'

type GeoPoint = { lat: number; lng: number }

/**
 * Bulgarian Cyrillic → Latin transliteration (BDS ISO 9 official standard).
 * Leaves non-Cyrillic characters (digits, punctuation, Latin) unchanged.
 */
export function transliterate(text: string): string {
  const MAP: Record<string, string> = {
    А: 'A',
    Б: 'B',
    В: 'V',
    Г: 'G',
    Д: 'D',
    Е: 'E',
    Ж: 'Zh',
    З: 'Z',
    И: 'I',
    Й: 'Y',
    К: 'K',
    Л: 'L',
    М: 'M',
    Н: 'N',
    О: 'O',
    П: 'P',
    Р: 'R',
    С: 'S',
    Т: 'T',
    У: 'U',
    Ф: 'F',
    Х: 'H',
    Ц: 'Ts',
    Ч: 'Ch',
    Ш: 'Sh',
    Щ: 'Sht',
    Ъ: 'A',
    Ь: 'Y',
    Ю: 'Yu',
    Я: 'Ya',
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sht',
    ъ: 'a',
    ь: 'y',
    ю: 'yu',
    я: 'ya',
  }
  return text
    .split('')
    .map((c) => MAP[c] ?? c)
    .join('')
}

/** Convert ALL-CAPS internal district code to Title Case for Nominatim. */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

/** Strip Bulgarian street-type prefixes (ул., бул., пл., кв., жк …) before geocoding. */
function stripStreetPrefix(address: string): string {
  return address.replace(/^(ул\.|бул\.|пл\.|пр\.|кв\.|ж\.к\.|жк)\s*/i, '').trim()
}

/**
 * Strip intersection/positional qualifiers so only the street name+number remain.
 * E.g. "Бурел с ул. Стефан Сарафов" → "Бурел"
 *      "Княз Борис I ъгъла с бул. Скобелев" → "Княз Борис I"
 * Sorted longest-first to avoid partial matches (ъгъла before ъгъл).
 */
function stripIntersectionWords(address: string): string {
  const words = ['срещу', 'ъгъла', 'ъгъл', 'до', 'на', 'с']
  const pattern = new RegExp('\\s+(?:' + words.join('|') + ')(?=\\s|$).*$', 'i')
  return address.replace(pattern, '').trim()
}

/** Normalize the XLS address string for use as cache key + query. */
export function normalizeAddress(raw: string): string {
  return raw
    .replace(/,?\s*вх\..*$/i, '') // remove entrance suffix (вх. А, вх. В …)
    .replace(/\s*\([^)]*\)/g, '') // remove parenthetical notes
    .replace(/[№#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Geocode a Sofia street address using Nominatim's structured API.
 * Results are persisted in the geocode-addresses collection (visible in admin UI).
 * Returns null if not found or on transient error.
 */
export async function geocodeAddress(
  raw: string,
  districtHint: string = 'Sofia',
  payload: BasePayload
): Promise<GeoPoint | null> {
  const normalized = normalizeAddress(raw)

  // Check DB cache
  const cached = await payload.find({
    collection: 'geocode-addresses',
    where: {
      and: [{ address: { equals: normalized } }, { districtHint: { equals: districtHint } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  if (cached.docs.length > 0) {
    const doc = cached.docs[0]!
    const loc = doc.location as [number, number] | null | undefined
    if (Array.isArray(loc)) return { lat: loc[1]!, lng: loc[0]! }
    return null // confirmed miss
  }

  // Not cached — query Nominatim
  const params = new URLSearchParams({
    street: transliterate(stripIntersectionWords(stripStreetPrefix(normalized))),
    city: 'Sofia',
    country: 'bg',
    format: 'json',
    limit: '5',
  })
  if (districtHint && districtHint !== 'Sofia') {
    params.set('county', toTitleCase(districtHint))
  }
  const url = `${NOMINATIM_BASE}?${params}`

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return null // transient — don't cache
    const results: { lat: string; lon: string }[] = await resp.json()

    let point: GeoPoint | null = null
    if (results.length > 0) {
      const first = results[0]!
      const lat = parseFloat(first.lat)
      const lng = parseFloat(first.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) point = { lat, lng }
    }

    await payload.create({
      collection: 'geocode-addresses',
      data: {
        address: normalized,
        districtHint,
        ...(point ? { location: [point.lng, point.lat] } : {}),
      },
      overrideAccess: true,
    })

    return point
  } catch {
    // Transient errors are NOT cached — address is retried on next run.
    return null
  }
}

/**
 * Rate-limiter: resolve after given ms (respects Nominatim's 1 req/s limit).
 * Call between geocoding requests; skip for cache hits.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
