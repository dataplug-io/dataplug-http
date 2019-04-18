module.exports = {
  preset: 'ts-jest',
  setupFiles: [
    './test/setup/winston.ts'
  ],
  clearMocks: true,
  testEnvironment: 'node',
}
