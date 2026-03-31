'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart2 } from 'lucide-react'

const MetricsNavLink: React.FC = () => {
  const pathname = usePathname()
  const isActive = pathname?.startsWith('/admin/metrics')

  return (
    <div style={{ padding: '0 8px' }}>
      <Link
        href="/admin/metrics"
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
        <BarChart2 size={16} />
        Metrics Dashboard
      </Link>
    </div>
  )
}

export default MetricsNavLink
