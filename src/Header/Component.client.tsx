'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'
import { MobileNav } from './Nav/MobileNav'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()
  const theme = headerTheme ?? null
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <header
      className="container relative z-20"
      suppressHydrationWarning
      {...(theme ? { 'data-theme': theme } : {})}
    >
      <div className="py-4 sm:py-8 flex justify-between items-center">
        <Link href="/">
          <Logo loading="eager" priority="high" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <HeaderNav data={data} />
          <Link
            href="/admin"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Вход
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={mobileOpen}
        >
          <span
            className={`block h-0.5 w-6 bg-gray-100 transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 bg-gray-100 transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 bg-gray-100 transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
    </header>
  )
}
