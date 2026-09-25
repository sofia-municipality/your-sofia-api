'use client'

import { useEffect, useState } from 'react'

export type FirmInfo = {
  firm: { id: number; name: string }
  contract: { id: number; name: string }
  licensePlate: string | null
}

/** Resolves firm (and truck, when vehicleId is given) via /api/waste-containers/firm-info. */
export function useFirmInfo({
  vehicleId,
  contractId,
}: {
  vehicleId?: number | null
  contractId?: number | null
}): { info: FirmInfo | null; loading: boolean } {
  const key = vehicleId || contractId ? `${vehicleId ?? ''}|${contractId ?? ''}` : null
  // Result is tagged with the request key so a stale response is never shown for new ids
  const [result, setResult] = useState<{ key: string; info: FirmInfo | null } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false

    const params = new URLSearchParams()
    if (vehicleId) params.set('vehicleId', String(vehicleId))
    if (contractId) params.set('contractId', String(contractId))

    fetch(`/api/waste-containers/firm-info?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<FirmInfo>) : null))
      .catch(() => null)
      .then((info) => {
        if (!cancelled) setResult({ key, info })
      })

    return () => {
      cancelled = true
    }
  }, [key, vehicleId, contractId])

  const current = key && result?.key === key ? result : null
  return { info: current?.info ?? null, loading: Boolean(key) && !current }
}
