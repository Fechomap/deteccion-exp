// Mock del logger para tests más limpios
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logError: jest.fn()
}));

const ServiceCacheService = require('../../src/services/service-cache.service');

describe('ServiceCacheService - Tests Avanzados', () => {
  let cacheService;

  beforeEach(() => {
    // Es una instancia singleton, limpiarla antes de cada test
    cacheService = ServiceCacheService;
    cacheService.serviceCache.clear();
  });

  describe('Operaciones Básicas de Cache', () => {
    test('debe almacenar y recuperar servicios correctamente', () => {
      const serviceData = {
        id: 'test_service_1',
        url: 'https://maps.google.com/test',
        messages: ['Tipo: Grúa', 'Vehículo: Toyota'],
        coordinates: ['4.6333,-74.0667'],
        timestamp: Date.now()
      };

      cacheService.storeService('test_service_1', serviceData);
      const retrieved = cacheService.getService('test_service_1');

      expect(retrieved).toEqual(serviceData);
      expect(retrieved.id).toBe('test_service_1');
    });

    test('debe retornar null para servicios inexistentes', () => {
      const result = cacheService.getService('non_existent_service');
      expect(result).toBeNull();
    });

    test('debe remover servicios correctamente', () => {
      const serviceData = { id: 'temp_service', data: 'test' };
      
      cacheService.storeService('temp_service', serviceData);
      expect(cacheService.getService('temp_service')).toEqual(serviceData);
      
      cacheService.removeService('temp_service');
      expect(cacheService.getService('temp_service')).toBeNull();
    });
  });

  describe('Manejo de Múltiples Servicios', () => {
    test('debe manejar múltiples servicios simultáneamente', () => {
      const services = [];
      
      for (let i = 1; i <= 10; i++) {
        const serviceData = {
          id: `service_${i}`,
          type: 'grua',
          priority: i % 3 === 0 ? 'high' : 'normal',
          timestamp: Date.now() + i
        };
        services.push(serviceData);
        cacheService.storeService(`service_${i}`, serviceData);
      }

      // Verificar que todos se almacenaron
      for (let i = 1; i <= 10; i++) {
        const retrieved = cacheService.getService(`service_${i}`);
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(`service_${i}`);
      }

      // Los servicios fueron almacenados correctamente
      expect(cacheService.serviceCache.size).toBe(10);
    });

    test('debe manejar sobreescritura de servicios', () => {
      const originalData = {
        id: 'overwrite_test',
        status: 'pending',
        data: 'original'
      };

      const updatedData = {
        id: 'overwrite_test',
        status: 'completed',
        data: 'updated'
      };

      cacheService.storeService('overwrite_test', originalData);
      expect(cacheService.getService('overwrite_test').status).toBe('pending');

      cacheService.storeService('overwrite_test', updatedData);
      expect(cacheService.getService('overwrite_test').status).toBe('completed');
    });
  });

  describe('Casos Extremos y Estrés', () => {
    test('debe manejar 1000 servicios sin degradación', () => {
      const startTime = Date.now();
      
      // Insertar 1000 servicios
      for (let i = 1; i <= 1000; i++) {
        cacheService.storeService(`stress_test_${i}`, {
          id: `stress_test_${i}`,
          data: `Data for service ${i}`,
          largePayload: 'x'.repeat(1000) // 1KB per service
        });
      }

      const insertTime = Date.now() - startTime;

      // Recuperar algunos servicios aleatoriamente
      const retrieveStart = Date.now();
      for (let i = 0; i < 100; i++) {
        const randomId = Math.floor(Math.random() * 1000) + 1;
        const service = cacheService.getService(`stress_test_${randomId}`);
        expect(service).toBeDefined();
        expect(service.id).toBe(`stress_test_${randomId}`);
      }
      const retrieveTime = Date.now() - retrieveStart;

      // Las operaciones deben ser rápidas
      expect(insertTime).toBeLessThan(1000); // Menos de 1 segundo
      expect(retrieveTime).toBeLessThan(100);  // Menos de 100ms
    });

    test('debe manejar datos con caracteres especiales', () => {
      const specialData = {
        id: 'special_chars_test',
        description: 'Servicio con émojis 🚗🔧 y acentos àáâãäå',
        location: 'Bogotá – Colombia (çñüéíóú)',
        unicode: '你好世界 مرحبا العالم Здравствуй мир',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
      };

      cacheService.storeService('special_chars_test', specialData);
      const retrieved = cacheService.getService('special_chars_test');

      expect(retrieved).toEqual(specialData);
      expect(retrieved.description).toContain('🚗🔧');
      expect(retrieved.location).toContain('Bogotá');
    });

    test('debe manejar valores null y undefined', () => {
      const edgeCaseData = {
        id: 'edge_case_test',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        emptyArray: [],
        emptyObject: {},
        zero: 0,
        false: false
      };

      cacheService.storeService('edge_case_test', edgeCaseData);
      const retrieved = cacheService.getService('edge_case_test');

      expect(retrieved.id).toBe('edge_case_test');
      expect(retrieved.nullValue).toBeNull();
      expect(retrieved.emptyString).toBe('');
      expect(retrieved.zero).toBe(0);
      expect(retrieved.false).toBe(false);
    });
  });

  describe('Integridad de Datos', () => {
    test('debe mantener integridad con operaciones concurrentes simuladas', async () => {
      const operations = [];
      const results = new Map();

      // Simular 50 operaciones concurrentes
      for (let i = 1; i <= 50; i++) {
        const operation = new Promise((resolve) => {
          const serviceId = `concurrent_${i}`;
          const serviceData = {
            id: serviceId,
            operationNumber: i,
            timestamp: Date.now()
          };

          cacheService.storeService(serviceId, serviceData);
          const retrieved = cacheService.getService(serviceId);
          results.set(serviceId, retrieved);
          resolve(retrieved);
        });
        operations.push(operation);
      }

      const allResults = await Promise.all(operations);

      expect(allResults).toHaveLength(50);
      expect(results.size).toBe(50);

      // Verificar integridad de cada operación
      for (let i = 1; i <= 50; i++) {
        const serviceId = `concurrent_${i}`;
        const result = results.get(serviceId);
        expect(result).toBeDefined();
        expect(result.operationNumber).toBe(i);
      }
    });

    test('debe preservar tipos de datos complejos', () => {
      const complexData = {
        id: 'complex_data_test',
        date: new Date(),
        regex: /test pattern/gi,
        function: () => 'test function',
        nested: {
          level1: {
            level2: {
              array: [1, 2, 3, { nested: 'value' }],
              set: new Set([1, 2, 3]),
              map: new Map([['key1', 'value1'], ['key2', 'value2']])
            }
          }
        }
      };

      cacheService.storeService('complex_data_test', complexData);
      const retrieved = cacheService.getService('complex_data_test');

      expect(retrieved.id).toBe('complex_data_test');
      expect(retrieved.date).toBeInstanceOf(Date);
      expect(retrieved.nested.level1.level2.array).toHaveLength(4);
    });
  });

  describe('Memoria y Rendimiento', () => {
    test('debe limpiar memoria correctamente al remover servicios', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Crear muchos servicios con datos grandes
      for (let i = 1; i <= 100; i++) {
        cacheService.storeService(`memory_test_${i}`, {
          id: `memory_test_${i}`,
          largeData: 'x'.repeat(10000), // 10KB per service
          timestamp: Date.now()
        });
      }

      const afterInsertMemory = process.memoryUsage().heapUsed;

      // Remover todos los servicios
      for (let i = 1; i <= 100; i++) {
        cacheService.removeService(`memory_test_${i}`);
      }

      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = process.memoryUsage().heapUsed;

      // La memoria después de limpiar debería ser similar a la inicial
      const memoryIncrease = (afterCleanupMemory - initialMemory) / (1024 * 1024);
      expect(memoryIncrease).toBeLessThan(10); // Menos de 10MB de aumento
    });
  });
});