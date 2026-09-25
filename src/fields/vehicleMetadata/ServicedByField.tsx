'use client'

import { useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import { ReadOnlyInfoField } from './ReadOnlyInfoField'
import { useFirmInfo } from './useFirmInfo'

/** `servicedBy` holds the GPS contract ID — show the firm and contract names instead. */
export const ServicedByField: NumberFieldClientComponent = ({ field, path }) => {
  const { value: contractId } = useField<number | null>({ path })
  const { info, loading } = useFirmInfo({ contractId })

  const text = !contractId
    ? ''
    : info
      ? `${info.firm.name} (договор ${info.contract.name})`
      : loading
        ? 'Зареждане…'
        : `Договор ${contractId}`

  return <ReadOnlyInfoField field={field} path={path} text={text} />
}
