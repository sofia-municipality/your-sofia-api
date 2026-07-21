'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { canViewFountains } from '@/access/cityInfrastructureAdmin'
import { PayloadRequest } from 'payload'
import { DrinkingFountainIcon } from './DrinkingFountainIcon'

const DrinkingFountainMapNavLink: React.FC = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const isActive = pathname?.startsWith('/admin/fountain-map')

  if (!canViewFountains({ req: { user } } as { req: PayloadRequest })) return null

  return (
    <div style={{ padding: '0 8px' }}>
      <Link
        href="/admin/fountain-map"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: isActive ? 600 : 400,
          background: isActive ? 'var(--theme-elevation-100, rgba(0,0,0,0.05))' : 'transparent',
          color: 'var(--theme-text)',
        }}
      >
        <DrinkingFountainIcon size={16} />
        Карта на чешмите
      </Link>
    </div>
  )
}

export default DrinkingFountainMapNavLink
