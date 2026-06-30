/**
 * @jest-environment jsdom
 *
 * Tests for all frontend nav menu items and their target pages.
 * Validates menu structure and that each internal page renders without errors.
 */
import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// Mirror of src/Header/Nav/index.tsx menus — single source of truth for tests
// ---------------------------------------------------------------------------
const MENUS = [
  {
    label: 'За проекта',
    items: [
      { label: 'Информация', href: '/about', external: false },
      { label: 'Виж Столична Община', href: 'https://sofia.bg', external: true },
    ],
  },
  {
    label: 'За потребители',
    items: [
      { label: 'Основни функционалности', href: '/for-users/features', external: false },
      { label: 'Често задавани въпроси', href: '/for-users/faq', external: false },
      { label: 'Условия за ползване', href: '/terms-of-use', external: false },
    ],
  },
  {
    label: 'За разработчици',
    items: [
      { label: 'Как да се включа?', href: '/for-developers/contribute', external: false },
      {
        label: 'Отворен код',
        href: 'https://github.com/sofia-municipality/your-sofia-mobile#your-sofia--%D1%82%D0%B2%D0%BE%D1%8F%D1%82%D0%B0-%D1%81%D0%BE%D1%84%D0%B8%D1%8F',
        external: true,
      },
    ],
  },
]

const ALL_ITEMS = MENUS.flatMap((m) => m.items)
const INTERNAL_ITEMS = ALL_ITEMS.filter((i) => !i.external)
const EXTERNAL_ITEMS = ALL_ITEMS.filter((i) => i.external)

// ---------------------------------------------------------------------------
// Page imports
// ---------------------------------------------------------------------------
import AboutPage from '../about/page'
import FeaturesPage from '../for-users/features/page'
import FaqPage from '../for-users/faq/page'
import ContributePage from '../for-developers/contribute/page'
import TermsOfUsePage from '../terms-of-use/page'

// ---------------------------------------------------------------------------
// Nav structure tests
// ---------------------------------------------------------------------------
describe('Nav menu structure', () => {
  it('has exactly three top-level menus', () => {
    expect(MENUS).toHaveLength(3)
  })

  it('every menu has a non-empty label', () => {
    MENUS.forEach((menu) => {
      expect(menu.label).toBeTruthy()
    })
  })

  it('every item has a non-empty label and href', () => {
    ALL_ITEMS.forEach((item) => {
      expect(item.label).toBeTruthy()
      expect(item.href).toBeTruthy()
    })
  })

  it('internal hrefs start with /', () => {
    INTERNAL_ITEMS.forEach((item) => {
      expect(item.href).toMatch(/^\//)
    })
  })

  it('external hrefs are valid URLs', () => {
    EXTERNAL_ITEMS.forEach((item) => {
      expect(() => new URL(item.href)).not.toThrow()
    })
  })

  it('contains the expected internal routes', () => {
    const internalHrefs = INTERNAL_ITEMS.map((i) => i.href)
    expect(internalHrefs).toEqual(
      expect.arrayContaining([
        '/about',
        '/for-users/features',
        '/for-users/faq',
        '/terms-of-use',
        '/for-developers/contribute',
      ])
    )
  })
})

// ---------------------------------------------------------------------------
// Page render tests — each internal nav target must mount without errors
// ---------------------------------------------------------------------------
describe('Nav target pages render without errors', () => {
  it('/about — renders with correct heading', () => {
    const { getByRole } = render(<AboutPage />)
    expect(getByRole('heading', { level: 1, name: /за проекта/i })).toBeInTheDocument()
  })

  it('/for-users/features — renders with correct heading', () => {
    const { getByRole } = render(<FeaturesPage />)
    expect(getByRole('heading', { level: 1, name: /основни функционалности/i })).toBeInTheDocument()
  })

  it('/for-users/faq — renders with correct heading', () => {
    const { getByRole } = render(<FaqPage />)
    expect(getByRole('heading', { level: 1, name: /често задавани въпроси/i })).toBeInTheDocument()
  })

  it('/terms-of-use — renders with correct heading', () => {
    const { getByRole } = render(<TermsOfUsePage />)
    expect(getByRole('heading', { level: 1, name: /общи условия/i })).toBeInTheDocument()
  })

  it('/for-developers/contribute — renders with correct heading', () => {
    const { getByRole } = render(<ContributePage />)
    expect(getByRole('heading', { level: 1, name: /как да се включа/i })).toBeInTheDocument()
  })

  it('/for-users/faq — renders all FAQ accordion items', () => {
    const { getAllByRole } = render(<FaqPage />)
    // Each FAQ is a button toggle (aria-expanded) — verify at least 5 are present
    const toggles = getAllByRole('button')
    expect(toggles.length).toBeGreaterThanOrEqual(5)
  })

  it('/for-users/features — renders all feature cards', () => {
    const { getAllByRole } = render(<FeaturesPage />)
    const headings = getAllByRole('heading', { level: 3 })
    expect(headings.length).toBeGreaterThanOrEqual(4)
  })

  it('/for-developers/contribute — renders all 4 steps', () => {
    const { container } = render(<ContributePage />)
    // Step numbers are rendered as visible text
    expect(container.textContent).toContain('01')
    expect(container.textContent).toContain('02')
    expect(container.textContent).toContain('03')
    expect(container.textContent).toContain('04')
  })

  it('/for-developers/contribute — GitHub links point to correct org', () => {
    const { container } = render(<ContributePage />)
    const anchors = Array.from(
      container.querySelectorAll('a[href*="github.com/sofia-municipality"]')
    )
    expect(anchors.length).toBeGreaterThanOrEqual(1)
  })
})
