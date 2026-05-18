import type { Payload } from 'payload'

export async function resolveOpenContainerSignals(
  payload: Payload,
  containerPublicNumber: string
): Promise<void> {
  try {
    const signalsToResolve = await payload.find({
      collection: 'signals',
      where: {
        and: [
          { 'cityObject.referenceId': { equals: containerPublicNumber } },
          { 'cityObject.type': { equals: 'waste-container' } },
          { status: { not_in: ['resolved', 'rejected'] } },
        ],
      },
      overrideAccess: true,
    })

    for (const signal of signalsToResolve.docs) {
      if (signal.containerState?.includes('bulkyWaste')) {
        // Skip signals for bulky waste as this requires manual inspection
        continue
      }

      const previousDescription = signal.description as string | undefined
      const autoCloseNote = `Автоматично затворен от GPS синхронизация на ${new Date().toISOString()}.`
      const updatedDescription = previousDescription
        ? `${previousDescription}\n\n${autoCloseNote}`
        : autoCloseNote

      await payload.update({
        collection: 'signals',
        id: signal.id,
        data: {
          status: 'resolved',
          description: updatedDescription,
        },
        overrideAccess: true,
      })
    }
  } catch (err) {
    payload.logger.error(
      `[processWasteCollectionEvents] Failed to resolve signals for container ${containerPublicNumber}: ${String(
        err
      )}`
    )
  }
}
