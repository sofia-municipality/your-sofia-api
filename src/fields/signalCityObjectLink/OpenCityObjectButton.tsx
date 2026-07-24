'use client'

import { useState } from 'react'
import { Button, useFormFields } from '@payloadcms/ui'

const LINKABLE_COLLECTIONS: Record<string, { slug: string }> = {
  'waste-container': { slug: 'waste-containers' },
  'drinking-fountain': { slug: 'drinking-fountains' },
}

export function OpenCityObjectButton() {
  const type = useFormFields(([fields]) => fields['cityObject.type']?.value) as string | undefined
  const referenceId = useFormFields(([fields]) => fields['cityObject.referenceId']?.value) as
    | string
    | undefined

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = type ? LINKABLE_COLLECTIONS[type] : undefined

  if (!target || !referenceId) return null

  const handleOpen = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        'where[publicNumber][equals]': referenceId,
        limit: '1',
        depth: '0',
      })
      const res = await fetch(`/api/${target.slug}?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { docs?: Array<{ id: number | string }> }
      const doc = data.docs?.[0]
      if (!doc) {
        setError('Обектът не беше открит')
        return
      }
      window.open(`/admin/collections/${target.slug}/${doc.id}`, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неуспешно отваряне на обекта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: 'var(--base, 20px)' }}>
      <Button buttonStyle="secondary" size="small" onClick={handleOpen} disabled={loading}>
        {loading ? 'Отваряне…' : `Отвори обекта (${referenceId})`}
      </Button>
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--theme-error-500, #DC2626)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
