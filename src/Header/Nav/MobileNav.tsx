'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

const menus = [
  {
    label: 'За проекта',
    items: [
      { label: 'Информация', href: '/about' },
      { label: 'Виж Столична Община', href: 'https://sofia.bg', external: true },
    ],
  },
  {
    label: 'За потребители',
    items: [
      { label: 'Основни функционалности', href: '/for-users/features' },
      { label: 'Често задавани въпроси', href: '/for-users/faq' },
      { label: 'Условия за ползване', href: '/terms-of-use' },
    ],
  },
  {
    label: 'За разработчици',
    items: [
      { label: 'Как да се включа?', href: '/for-developers/contribute' },
      {
        label: 'Отворен код',
        href: 'https://github.com/sofia-municipality/your-sofia-mobile',
        external: true,
        icon: <GitHubIcon />,
      },
    ],
  },
]

export const MobileNav: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [openSection, setOpenSection] = useState<string | null>(null)

  return (
    <div className="md:hidden border-t border-gray-600 pb-4">
      {menus.map((menu) => (
        <div key={menu.label}>
          <button
            className="w-full flex justify-between items-center px-2 py-3 text-sm font-medium text-gray-100"
            onClick={() => setOpenSection(openSection === menu.label ? null : menu.label)}
          >
            {menu.label}
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform duration-150 ${openSection === menu.label ? 'rotate-180' : ''}`}
            />
          </button>
          {openSection === menu.label && (
            <div className="pl-4 flex flex-col">
              {menu.items.map(({ label, href, external, icon }) =>
                external ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-2.5 text-sm text-gray-300 hover:text-white"
                    onClick={onClose}
                  >
                    {icon}
                    {label}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 py-2.5 text-sm text-gray-300 hover:text-white"
                    onClick={onClose}
                  >
                    {icon}
                    {label}
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      ))}
      <div className="mt-3 px-2">
        <Link
          href="/admin"
          className="block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          onClick={onClose}
        >
          Вход
        </Link>
      </div>
    </div>
  )
}
