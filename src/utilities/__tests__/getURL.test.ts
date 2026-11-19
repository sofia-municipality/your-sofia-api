type GetURLModule = typeof import('../getURL')

const ENV_KEYS = ['NEXT_PUBLIC_SERVER_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const

// canUseDOM is evaluated once at import time, so each case loads a fresh copy of the module.
const loadModule = (canUseDOM: boolean): GetURLModule => {
  let mod: GetURLModule | undefined
  jest.isolateModules(() => {
    jest.doMock('../canUseDOM', () => ({ __esModule: true, default: canUseDOM }))
    mod = jest.requireActual<GetURLModule>('../getURL')
  })
  return mod!
}

describe('getURL utilities (unit)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  describe('getServerSideURL', () => {
    it('uses NEXT_PUBLIC_SERVER_URL when set', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://api.example.test'
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vercel.example.test'

      expect(loadModule(false).getServerSideURL()).toBe('https://api.example.test')
    })

    it('falls back to the Vercel production URL', () => {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vercel.example.test'

      expect(loadModule(false).getServerSideURL()).toBe('https://vercel.example.test')
    })

    it('defaults to localhost:3000', () => {
      expect(loadModule(false).getServerSideURL()).toBe('http://localhost:3000')
    })
  })

  describe('getClientSideURL', () => {
    it('builds the URL from window.location in the browser', () => {
      const hadWindow = 'window' in globalThis
      const originalWindow = (globalThis as { window?: unknown }).window
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { location: { protocol: 'https:', hostname: 'sofia.example.test', port: '8443' } },
      })

      try {
        expect(loadModule(true).getClientSideURL()).toBe('https://sofia.example.test:8443')
        ;(globalThis as { window: { location: { port: string } } }).window.location.port = ''
        expect(loadModule(true).getClientSideURL()).toBe('https://sofia.example.test')
      } finally {
        if (hadWindow) {
          Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
        } else {
          Reflect.deleteProperty(globalThis, 'window')
        }
      }
    })

    it('prefers the Vercel production URL on the server', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://api.example.test'
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vercel.example.test'

      expect(loadModule(false).getClientSideURL()).toBe('https://vercel.example.test')
    })

    it('falls back to NEXT_PUBLIC_SERVER_URL, then an empty string', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://api.example.test'
      expect(loadModule(false).getClientSideURL()).toBe('https://api.example.test')

      Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SERVER_URL')
      expect(loadModule(false).getClientSideURL()).toBe('')
    })
  })
})
