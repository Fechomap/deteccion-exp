const TelegramBot = require('node-telegram-bot-api');
const AuthService = require('../../src/services/auth.service');
const ServiceCacheService = require('../../src/services/service-cache.service');
const MessageQueueService = require('../../src/services/queue');

// Mock del bot de Telegram
jest.mock('node-telegram-bot-api');

describe('Telegram Bot Integration Tests - Flujos Complejos', () => {
  let mockBot;
  let mockServices;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mock del bot
    mockBot = {
      on: jest.fn(),
      onText: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      answerCallbackQuery: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true)
    };

    TelegramBot.mockImplementation(() => mockBot);

    // Configurar servicios mock
    mockServices = {
      config: {
        ALLOWED_CHAT_IDS: ['123456789', '987654321']
      },
      queue: MessageQueueService,
      serviceCache: new ServiceCacheService(),
      auth: AuthService
    };
  });

  describe('Flujo Completo de Procesamiento de Servicios', () => {
    test('debe procesar URL de Google Maps y crear servicio completo', async () => {
      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      const mockMessage = {
        chat: { id: '123456789' },
        from: { id: '123456789', first_name: 'TestUser' },
        text: 'Servicio urgente en https://maps.google.com/maps?q=4.6333,-74.0667&z=17',
        message_id: 456
      };

      // Simular que puede manejar el mensaje
      expect(handler.canHandle(mockMessage)).toBe(true);

      // Mock de respuestas de OpenAI
      const mockOpenAIResponse = {
        tipoServicio: 'Grúa',
        ubicacion: 'Bogotá, Colombia',
        descripcion: 'Servicio de grúa urgente',
        prioridad: 'Alta'
      };

      // Mock del servicio OpenAI
      mockServices.openai = {
        parseServiceInfo: jest.fn().mockResolvedValue(mockOpenAIResponse)
      };

      await handler.handle(mockBot, mockMessage);

      // Verificar que se llamaron los métodos correctos
      expect(mockServices.openai.parseServiceInfo).toHaveBeenCalled();
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('🔄 Procesando información del servicio')
      );
    });

    test('debe manejar múltiples usuarios tomando servicios simultáneamente', async () => {
      const ServiceActionHandler = require('../../src/handlers/callbacks/service-action.handler');
      const handler = new ServiceActionHandler(mockServices);

      // Crear un servicio en caché
      const serviceData = {
        id: 'service_123',
        url: 'https://maps.google.com/test',
        messages: ['Tipo: Grúa', 'Vehículo: Chevrolet Spark'],
        coordinates: ['4.6333,-74.0667']
      };
      
      mockServices.serviceCache.setService('service_123', serviceData);

      // Simular dos usuarios tratando de tomar el mismo servicio
      const query1 = {
        id: 'query_1',
        data: 'take_service:service_123',
        from: { id: '123456789', first_name: 'User1' },
        message: {
          chat: { id: '123456789' },
          message_id: 789
        }
      };

      const query2 = {
        id: 'query_2',
        data: 'take_service:service_123',
        from: { id: '987654321', first_name: 'User2' },
        message: {
          chat: { id: '987654321' },
          message_id: 790
        }
      };

      // Procesar ambos callbacks casi simultáneamente
      const promise1 = handler.handleCallback(mockBot, query1);
      const promise2 = handler.handleCallback(mockBot, query2);

      await Promise.all([promise1, promise2]);

      // Verificar que ambos usuarios recibieron respuestas
      expect(mockBot.answerCallbackQuery).toHaveBeenCalledTimes(2);
      expect(mockBot.editMessageText).toHaveBeenCalledTimes(2);
    });
  });

  describe('Manejo de Errores en Flujos Críticos', () => {
    test('debe recuperarse de fallos de OpenAI gracefully', async () => {
      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      const mockMessage = {
        chat: { id: '123456789' },
        from: { id: '123456789' },
        text: 'https://maps.google.com/maps?q=4.6333,-74.0667',
        message_id: 456
      };

      // Mock de fallo en OpenAI
      mockServices.openai = {
        parseServiceInfo: jest.fn().mockRejectedValue(new Error('OpenAI API Error'))
      };

      await handler.handle(mockBot, mockMessage);

      // Verificar que se envió un mensaje de error al usuario
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('Error')
      );
    });

    test('debe manejar rate limiting de Telegram API', async () => {
      const handler = require('../../src/handlers/messages/service.handler');
      
      // Simular rate limiting
      mockBot.sendMessage.mockRejectedValueOnce({
        code: 'ETELEGRAM',
        response: { statusCode: 429 }
      });

      const mockMessage = {
        chat: { id: '123456789' },
        text: 'Mensaje de prueba que debería triggear rate limiting'
      };

      // El handler debería manejar el error gracefully
      await expect(async () => {
        const serviceHandler = new handler(mockServices);
        if (serviceHandler.canHandle(mockMessage)) {
          await serviceHandler.handle(mockBot, mockMessage);
        }
      }).not.toThrow();
    });
  });

  describe('Tests de Seguridad y Autorización', () => {
    test('debe bloquear usuarios no autorizados consistentemente', async () => {
      const unauthorizedMessage = {
        chat: { id: '999999999' }, // ID no autorizado
        from: { id: '999999999' },
        text: 'https://maps.google.com/maps?q=4.6333,-74.0667'
      };

      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      // Verificar que el handler no procese el mensaje
      const canHandle = handler.canHandle(unauthorizedMessage);
      expect(canHandle).toBe(true); // Puede manejar el formato

      // Pero la autorización debería fallar en el registry
      expect(AuthService.validateMessage(unauthorizedMessage)).toBe(false);
    });

    test('debe prevenir ataques de inyección en callbacks', async () => {
      const ServiceActionHandler = require('../../src/handlers/callbacks/service-action.handler');
      const handler = new ServiceActionHandler(mockServices);

      const maliciousCallback = {
        id: 'malicious_query',
        data: 'take_service:../../../etc/passwd',
        from: { id: '123456789', first_name: 'Attacker' },
        message: {
          chat: { id: '123456789' },
          message_id: 999
        }
      };

      await handler.handleCallback(mockBot, maliciousCallback);

      // Verificar que se manejó como servicio no encontrado
      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
        'malicious_query',
        expect.objectContaining({
          text: expect.stringContaining('no está disponible')
        })
      );
    });
  });

  describe('Tests de Rendimiento bajo Carga', () => {
    test('debe manejar ráfaga de 50 mensajes simultáneos', async () => {
      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      const promises = [];
      const startTime = Date.now();

      // Mock simple de OpenAI para velocidad
      mockServices.openai = {
        parseServiceInfo: jest.fn().mockResolvedValue({
          tipoServicio: 'Test',
          ubicacion: 'Test Location'
        })
      };

      for (let i = 1; i <= 50; i++) {
        const mockMessage = {
          chat: { id: '123456789' },
          from: { id: '123456789' },
          text: `https://maps.google.com/maps?q=4.${i},-74.${i}`,
          message_id: 1000 + i
        };

        const promise = handler.handle(mockBot, mockMessage);
        promises.push(promise);
      }

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Debe completarse en tiempo razonable (menos de 5 segundos)
      expect(duration).toBeLessThan(5000);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(50);
    }, 10000);

    test('debe mantener memoria estable con procesamiento intensivo', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      // Mock que simula respuesta grande de OpenAI
      mockServices.openai = {
        parseServiceInfo: jest.fn().mockResolvedValue({
          tipoServicio: 'Grúa Premium',
          ubicacion: 'Ubicación detallada con mucha información',
          descripcion: 'x'.repeat(10000), // 10KB de descripción
          detalles: new Array(1000).fill('Detalle importante'),
          coordenadas: new Array(100).fill('4.6333,-74.0667')
        })
      };

      // Procesar muchos mensajes con payloads grandes
      for (let batch = 1; batch <= 10; batch++) {
        const promises = [];
        
        for (let i = 1; i <= 20; i++) {
          const mockMessage = {
            chat: { id: '123456789' },
            from: { id: '123456789' },
            text: `https://maps.google.com/maps?q=4.${batch}${i},-74.${batch}${i}`,
            message_id: batch * 1000 + i
          };

          promises.push(handler.handle(mockBot, mockMessage));
        }
        
        await Promise.all(promises);
        
        // Limpiar entre lotes
        if (global.gc) global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB

      // El aumento de memoria no debe ser excesivo
      expect(memoryIncrease).toBeLessThan(100); // Menos de 100MB
    }, 15000);
  });

  describe('Tests de Recuperación y Resiliencia', () => {
    test('debe recuperarse de desconexión temporal de Telegram', async () => {
      let connectionFailed = false;
      
      // Simular fallo temporal de conexión
      mockBot.sendMessage.mockImplementation(() => {
        if (!connectionFailed) {
          connectionFailed = true;
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve({ message_id: 123 });
      });

      const MapsHandler = require('../../src/handlers/messages/maps.handler');
      const handler = new MapsHandler(mockServices);

      mockServices.openai = {
        parseServiceInfo: jest.fn().mockResolvedValue({
          tipoServicio: 'Test'
        })
      };

      const mockMessage = {
        chat: { id: '123456789' },
        from: { id: '123456789' },
        text: 'https://maps.google.com/maps?q=4.6333,-74.0667',
        message_id: 456
      };

      // Primera llamada falla, pero debería continuar
      await handler.handle(mockBot, mockMessage);

      // Verificar que se intentó enviar al menos una vez
      expect(mockBot.sendMessage).toHaveBeenCalled();
    });

    test('debe mantener consistencia durante reinicio simulado', async () => {
      const ServiceCacheService = require('../../src/services/service-cache.service');
      const cache = new ServiceCacheService();

      // Simular datos críticos
      const criticalServices = [];
      for (let i = 1; i <= 10; i++) {
        const serviceData = {
          id: `critical_service_${i}`,
          timestamp: Date.now(),
          priority: 'high',
          data: `Critical data ${i}`
        };
        cache.setService(serviceData.id, serviceData);
        criticalServices.push(serviceData);
      }

      // Simular "crash" y recuperación
      const allServices = cache.getAllServices();
      
      // Verificar que todos los servicios críticos están presentes
      expect(Object.keys(allServices)).toHaveLength(10);
      
      criticalServices.forEach(service => {
        expect(allServices[service.id]).toBeDefined();
        expect(allServices[service.id].data).toBe(service.data);
      });
    });
  });
});