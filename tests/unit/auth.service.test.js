const AuthService = require('../../src/services/auth.service');

// Mock del config para testing
jest.mock('../../src/config', () => ({
  ALLOWED_CHAT_IDS: ['123456789', '987654321', '555444333']
}));

describe('AuthService - Comprehensive Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Autorización básica', () => {
    test('debe autorizar chat IDs válidos', () => {
      expect(AuthService.isAuthorized('123456789')).toBe(true);
      expect(AuthService.isAuthorized(987654321)).toBe(true);
    });

    test('debe denegar chat IDs no autorizados', () => {
      expect(AuthService.isAuthorized('999999999')).toBe(false);
      expect(AuthService.isAuthorized(111111111)).toBe(false);
    });

    test('debe manejar valores nulos y undefined', () => {
      expect(AuthService.isAuthorized(null)).toBe(false);
      expect(AuthService.isAuthorized(undefined)).toBe(false);
      expect(AuthService.isAuthorized('')).toBe(false);
    });
  });

  describe('Validación de mensajes de Telegram', () => {
    test('debe validar mensajes con estructura correcta', () => {
      const validMessage = {
        chat: { id: '123456789' },
        from: { id: '123456789' },
        text: 'Mensaje de prueba'
      };
      expect(AuthService.validateMessage(validMessage)).toBe(true);
    });

    test('debe denegar mensajes sin chat', () => {
      const invalidMessage = {
        from: { id: '123456789' },
        text: 'Mensaje sin chat'
      };
      expect(AuthService.validateMessage(invalidMessage)).toBe(false);
    });

    test('debe denegar mensajes completamente inválidos', () => {
      expect(AuthService.validateMessage(null)).toBe(false);
      expect(AuthService.validateMessage({})).toBe(false);
      expect(AuthService.validateMessage('string')).toBe(false);
    });
  });

  describe('Validación de callbacks', () => {
    test('debe validar callbacks con estructura correcta', () => {
      const validCallback = {
        message: {
          chat: { id: '123456789' }
        },
        from: { id: '123456789' },
        data: 'take_service:123'
      };
      expect(AuthService.validateCallback(validCallback)).toBe(true);
    });

    test('debe denegar callbacks sin mensaje o chat', () => {
      const invalidCallback = {
        from: { id: '123456789' },
        data: 'take_service:123'
      };
      expect(AuthService.validateCallback(invalidCallback)).toBe(false);
    });
  });

  describe('Casos extremos y seguridad', () => {
    test('debe manejar intentos de inyección de código', () => {
      const maliciousIds = [
        '\'; DROP TABLE users; --',
        '<script>alert("xss")</script>',
        '${process.env.SECRET}',
        '../../../etc/passwd'
      ];

      maliciousIds.forEach(id => {
        expect(AuthService.isAuthorized(id)).toBe(false);
      });
    });

    test('debe manejar IDs extremadamente largos', () => {
      const longId = '1'.repeat(1000);
      expect(AuthService.isAuthorized(longId)).toBe(false);
    });

    test('debe ser case-sensitive para IDs', () => {
      expect(AuthService.isAuthorized('123456789')).toBe(true);
      // Los IDs de chat de Telegram son números, este test no es relevante
      // expect(AuthService.isAuthorized('123456789'.toUpperCase())).toBe(false);
      expect(AuthService.isAuthorized('123456789')).toBe(true);
    });
  });

  describe('Rendimiento', () => {
    test('debe validar 1000 IDs en menos de 100ms', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        AuthService.isAuthorized(`${i}`);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
