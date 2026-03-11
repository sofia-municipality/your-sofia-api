'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

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
        {/* Simple bar chart icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        Metrics Dashboard
      </Link>
    </div>
  )
}

export default MetricsNavLink
