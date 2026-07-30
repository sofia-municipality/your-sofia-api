import { seedDrinkingFountainsFromEnv } from '../utilities/seedDrinkingFountains'

async function main(): Promise<void> {
  try {
    await seedDrinkingFountainsFromEnv()
    process.exit(0)
  } catch (error) {
    console.error('Failed to seed drinking fountains:', error)
    process.exit(1)
  }
}

void main()
