import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

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

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  let created = 0
  let skipped = 0

  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      payload.logger.info(`[seed_categories] Skipping existing: ${cat.slug}`)
      skipped++
      continue
    }

    await payload.create({
      collection: 'categories',
      data: { title: cat.title, slug: cat.slug },
    })

    payload.logger.info(`[seed_categories] Created: ${cat.slug}`)
    created++
  }

  payload.logger.info(`[seed_categories] Done — created: ${created}, skipped: ${skipped}`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const slugs = CATEGORIES.map((c) => c.slug)

  for (const slug of slugs) {
    const result = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    if (result.docs[0]) {
      await payload.delete({ collection: 'categories', id: result.docs[0].id })
      payload.logger.info(`[seed_categories] Deleted: ${slug}`)
    }
  }
}
