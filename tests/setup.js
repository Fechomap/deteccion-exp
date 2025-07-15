// Setup global para tests
require('dotenv').config({ path: '.env.test' });

// Mock console para tests más limpios
global.console = {
  ...console,
  // Mantener error y warn para debugging
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_TOKEN = 'test_token';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.ALLOWED_CHAT_IDS = '123456789,987654321';

// Timeout global para async operations
jest.setTimeout(10000);
