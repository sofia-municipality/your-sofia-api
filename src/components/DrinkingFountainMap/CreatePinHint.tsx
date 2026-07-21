'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/cssVariables'

interface CreatePinHintProps {
  lat: number
  lng: number
  screenX: number
  screenY: number
  onDismiss: () => void
}

export function CreatePinHint({ lat, lng, screenX, screenY, onDismiss }: CreatePinHintProps) {
  const router = useRouter()

  const handleCreate = () => {
    try {
      sessionStorage.setItem('prefill_drinking_fountain_location', JSON.stringify({ lat, lng }))
    } catch {
      // sessionStorage not available
    }
    router.push('/admin/collections/drinking-fountains/create')
  }

  const LEFT_OFFSET = 12
  const TOP_OFFSET = -48
  const style: React.CSSProperties = {
    position: 'absolute',
    left: screenX + LEFT_OFFSET,
    top: screenY + TOP_OFFSET,
    background: colors.surface,
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    border: `1px solid ${colors.border}`,
    padding: '8px 12px',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    fontSize: 13,
  }

  return (
    <div style={style}>
      <span style={{ color: colors.textMuted }}>
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </span>
      <button
        onClick={handleCreate}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: colors.primaryDark,
          color: '#fff',
          border: 'none',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Нова чешма
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.textMuted,
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}
