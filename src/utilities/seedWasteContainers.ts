import { Payload } from 'payload'

/**
 * Seed waste containers data
 * Run with: pnpm seed:waste-containers
 */
export async function seedWasteContainers(payload: Payload): Promise<void> {
  console.log('🌱 Seeding waste containers...')

  const containers = [
    {
      publicNumber: 'SKS-001',
      location: {
        latitude: 42.6845213,
        longitude: 23.2752809,
        address: 'ул. "Житница"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SKS-002',
      location: {
        latitude: 42.6759185,
        longitude: 23.2705008,
        address: 'ул. "Коломан", пред стадион "Славия"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SKS-003',
      location: {
        latitude: 42.6825707,
        longitude: 23.2930608,
        address: 'бул. "Цар Борис III" и ул. "Булаир"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-004',
      location: {
        latitude: 42.7268292,
        longitude: 23.261249,
        address: 'бул. "Панчо Владигеров" и бул. "Сливница", пред метростанция "Сливница"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-005',
      location: {
        latitude: 42.7179342,
        longitude: 23.2535311,
        address: 'бул. "Панчо Владигеров", срещу пазар "Люлин"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-006',
      location: {
        latitude: 42.733033,
        longitude: 23.2499966,
        address: 'ул. "Добринова скала" и бул. "Сливница"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-007',
      location: {
        latitude: 42.7186116,
        longitude: 23.2385284,
        address: 'ул. "Добринова скала" и ул. "Райко Даскалов" срещу бл. 523',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-008',
      location: {
        latitude: 42.712735,
        longitude: 23.2391614,
        address: 'ул. "Д-р Петър Дертлиев", срещу м-н "Билла"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-009',
      location: {
        latitude: 42.7134485,
        longitude: 23.2747275,
        address: 'ул. "Д-р Петър Дертлиев", при Западен парк',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-010',
      location: {
        latitude: 42.7218833,
        longitude: 23.2707256,
        address: 'бул. "Сливница" и ул. "Беравица"',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
    {
      publicNumber: 'SLN-011',
      location: {
        latitude: 42.7421385,
        longitude: 23.2560837,
        address: 'ул. 3-та № 34-38',
      },
      capacityVolume: 10,
      capacitySize: 'big' as const,
      serviceInterval: 'Ежедневно',
      servicedBy: 'Столична община',
      wasteType: 'general' as const,
      status: 'active' as const,
    },
  ]

  let created = 0
  let skipped = 0

  for (const container of containers) {
    try {
      // Check if container already exists
      const existing = await payload.find({
        collection: 'waste-containers',
        where: {
          publicNumber: {
            equals: container.publicNumber,
          },
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`⏭️  Skipping ${container.publicNumber} - already exists`)
        skipped++
        continue
      }

      // Create the container
      await payload.create({
        collection: 'waste-containers',
        data: container,
      })

      console.log(`✅ Created container ${container.publicNumber} at ${container.location.address}`)
      created++
    } catch (error) {
      console.error(`❌ Error creating container ${container.publicNumber}:`, error)
    }
  }

  console.log(`\n✨ Seeding complete!`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total: ${containers.length}`)
}
