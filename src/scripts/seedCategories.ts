/**
 * One-time seed script: inserts the 18 service categories into the `categories` collection.
 *
 * Run with:
 *   pnpm payload run src/scripts/seedCategories.ts
 *
 * The script is idempotent - existing slugs are skipped.
 */

import payload from 'payload'
import config from '../payload.config'

const CATEGORIES: { title: string; slug: string }[] = [
  { title: 'Вода', slug: 'water' },
  { title: 'Електричество', slug: 'electricity' },
  { title: 'Отопление', slug: 'heating' },
  { title: 'Трафик', slug: 'traffic' },
  { title: 'Строителство и ремонти', slug: 'construction-and-repairs' },
  { title: 'Блокирани пътища', slug: 'road-block' },
  { title: 'Градски транспорт', slug: 'public-transport' },
  { title: 'Паркиране', slug: 'parking' },
  { title: 'Отпадъци', slug: 'waste' },
  { title: 'Време', slug: 'weather' },
  { title: 'Качество на въздуха', slug: 'air-quality' },
  { title: 'Превозни средства', slug: 'vehicles' },
  { title: 'Здраве', slug: 'health' },
  { title: 'Култура', slug: 'culture' },
  { title: 'Изкуство', slug: 'art' },
  { title: 'Спорт', slug: 'sports' },
  { title: 'Велосипеди', slug: 'bicycles' },
]

async function main() {
  await payload.init({ config })

  let created = 0
  let skipped = 0

  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      payload.logger.info(`Skipping existing category: ${cat.slug}`)
      skipped++
      continue
    }

    await payload.create({
      collection: 'categories',
      data: { title: cat.title, slug: cat.slug },
    })

    payload.logger.info(`Created category: ${cat.slug}`)
    created++
  }

  payload.logger.info(`Done. Created: ${created}, Skipped: ${skipped}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
