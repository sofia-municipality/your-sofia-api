/**
 * Sofia administrative district options shared across collections.
 * The numeric string value matches the GPS API Region field (1–24).
 */
export const DISTRICT_OPTIONS = [
  { label: 'Bankya (1)', value: '1' },
  { label: 'Vitosha (2)', value: '2' },
  { label: 'Vrabnitsa (3)', value: '3' },
  { label: 'Vazrazhdane (4)', value: '4' },
  { label: 'Izgrev (5)', value: '5' },
  { label: 'Ilinden (6)', value: '6' },
  { label: 'Iskar (7)', value: '7' },
  { label: 'Krasna Polyana (8)', value: '8' },
  { label: 'Krasno Selo (9)', value: '9' },
  { label: 'Kremikovtsi (10)', value: '10' },
  { label: 'Lozenets (11)', value: '11' },
  { label: 'Lyulin (12)', value: '12' },
  { label: 'Mladost (13)', value: '13' },
  { label: 'Nadezhda (14)', value: '14' },
  { label: 'Novi Iskar (15)', value: '15' },
  { label: 'Ovcha Kupel (16)', value: '16' },
  { label: 'Oborishte (17)', value: '17' },
  { label: 'Pancharevo (18)', value: '18' },
  { label: 'Poduene (19)', value: '19' },
  { label: 'Serdika (20)', value: '20' },
  { label: 'Slatina (21)', value: '21' },
  { label: 'Studentski (22)', value: '22' },
  { label: 'Sredets (23)', value: '23' },
  { label: 'Triaditsa (24)', value: '24' },
]

/** Map district value string → human-readable label */
export const DISTRICT_LABEL: Record<string, string> = Object.fromEntries(
  DISTRICT_OPTIONS.map(({ value, label }) => [value, label.replace(/ \(\d+\)$/, '')])
)
