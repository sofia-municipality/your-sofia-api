'use client'

import { useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import { ReadOnlyInfoField } from './ReadOnlyInfoField'
import { useFirmInfo } from './useFirmInfo'

/** `lastCleanedBy` holds the GPS VehicleId — show the truck's plate and firm instead. */
export const LastCleanedByField: NumberFieldClientComponent = ({ field, path }) => {
  const { value: vehicleId } = useField<number | null>({ path })
  const { info, loading } = useFirmInfo({ vehicleId })

  const text = !vehicleId
    ? ''
    : info?.licensePlate
      ? `${info.licensePlate} · ${info.firm.name} (ID ${vehicleId})`
      : loading
        ? 'Зареждане…'
        : `ID ${vehicleId}`

  return <ReadOnlyInfoField field={field} path={path} text={text} />
}
