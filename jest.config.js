module.exports = {
  // Directorio raíz del proyecto
  rootDir: '.',

  // Directorios donde buscar tests
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],

  // Entorno de testing
  testEnvironment: 'node',

  // Configuración de cobertura
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Archivos a incluir en el análisis de cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js', // Archivo de inicio
    '!**/node_modules/**'
  ],

  // Umbrales de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Configuración para mocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Variables de entorno para testing
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Timeout para tests (en ms)
  testTimeout: 10000,

  // Verbose output
  verbose: true
};
