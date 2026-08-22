module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/workers/emailWorker.ts',
    '!src/docs/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000
};
