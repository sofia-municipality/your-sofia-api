import type { Endpoint } from 'payload'
import { getContractFirm, getVehicleMetadata } from '@/tasks/WasteCollection/contractFirmCache'

const parseId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * GET /api/waste-containers/firm-info?vehicleId=955575&contractId=70
 *
 * Resolves the firm servicing a container. The vehicle (lastCleanedBy / latest
 * observation) is tried first; otherwise the contract (servicedBy) is used.
 * Returns { firm, contract, licensePlate } or 404 when nothing can be resolved.
 */
export const firmInfo: Endpoint = {
  path: '/firm-info',
  method: 'get',
  handler: async (req) => {
    const { logger } = req.payload
    const vehicleId = parseId(req.query?.vehicleId)
    const contractId = parseId(req.query?.contractId)

    if (!vehicleId && !contractId) {
      return Response.json({ error: 'vehicleId or contractId is required' }, { status: 400 })
    }

    if (vehicleId) {
      const vehicle = await getVehicleMetadata(vehicleId, logger)
      if (vehicle) {
        return Response.json({
          firm: vehicle.firm,
          contract: vehicle.contract,
          licensePlate: vehicle.license_plate,
        })
      }
    }

    if (contractId) {
      const contractFirm = await getContractFirm(contractId, logger)
      if (contractFirm) {
        return Response.json({ ...contractFirm, licensePlate: null })
      }
    }

    return Response.json({ error: 'Firm not found' }, { status: 404 })
  },
}
