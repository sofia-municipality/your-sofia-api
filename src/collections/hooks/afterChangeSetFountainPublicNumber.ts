import type { CollectionAfterChangeHook } from 'payload'

/**
 * Assigns a stable public identifier to a fountain on creation, in the form
 * `DF-<district code>-<zero-padded id>` (e.g. `DF-RTR-0001`). The id is only
 * known after the row is inserted, so this runs as an afterChange hook on
 * create and writes the value back with a second update. The `publicNumber`
 * guard makes that second write (operation === 'update') a no-op, so there's
 * no loop. Fountains without a district fall back to the `XXX` code.
 */
export const afterChangeSetFountainPublicNumber: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
  if (operation !== 'create') return doc
  if (doc.publicNumber) return doc

  let code = 'XXX'
  const districtId = typeof doc.district === 'object' ? doc.district?.id : doc.district
  if (districtId) {
    try {
      const district = await req.payload.findByID({
        collection: 'city-districts',
        id: districtId,
        depth: 0,
        req,
      })
      if (district?.code) code = district.code
    } catch (error) {
      req.payload.logger.error(`Failed to resolve district code for fountain ${doc.id}: ${error}`)
    }
  }

  const publicNumber = `DF-${code}-${String(doc.id).padStart(4, '0')}`

  try {
    await req.payload.update({
      collection: 'drinking-fountains',
      id: doc.id,
      data: { publicNumber },
      req,
      overrideAccess: true,
    })
  } catch (error) {
    req.payload.logger.error(`Failed to set publicNumber for fountain ${doc.id}: ${error}`)
    return doc
  }

  return { ...doc, publicNumber }
}
