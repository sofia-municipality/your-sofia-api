import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

describe('HomePage component (unit render)', () => {
  beforeEach(() => {
    jest.resetModules()
    // Mock next/image to a simple img for server-side rendering
    jest.doMock('next/image', () => ({
      __esModule: true,
      default: (props: any) => React.createElement('img', { src: props.src, alt: props.alt, className: props.className }),
    }))

    // Mock next/link to a simple anchor
    jest.doMock('next/link', () => ({
      __esModule: true,
      default: ({ children, href, ...rest }: any) => React.createElement('a', { href, ...rest }, children),
    }))
  })

  it('renders main home page elements', () => {
    const HomePage = require('../page').default
    const html = renderToStaticMarkup(React.createElement(HomePage))

    expect(html).toContain('Твоята София')
    expect(html).toContain('Download the App')
    expect(html).toContain('City News')
    expect(html).toContain('Interactive Map')
    expect(html).toContain('Report Issues')
    expect(html).toContain('App Store')
  })
})
