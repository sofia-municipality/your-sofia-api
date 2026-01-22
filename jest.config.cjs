/** @type {import('jest').Config} */
module.exports = {
  // Use Babel to transform TS/TSX via babel-jest (Babel config in babel.config.js)
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/e2e'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)', '**/?(*.)+(spec|test).(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/payload-types.ts',
    '!src/migrations/**',
    '!src/scripts/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 20000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Transform payload and @payloadcms packages so ESM syntax in their dist files is handled
  transformIgnorePatterns: ['node_modules/(?!(payload|@payloadcms|@payloadcms/db-postgres)/)'],
}