const QueueService = require('../../src/services/queue/queue.service');

describe('QueueService - Tests Avanzados de Concurrencia y Rendimiento', () => {
  let queueService;

  beforeEach(() => {
    queueService = new QueueService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Los servicios no tienen método stop, limpiar manualmente
    if (queueService && queueService.messageQueues) {
      queueService.messageQueues.clear();
      queueService.processingStatus.clear();
    }
  });

  describe('Concurrencia y Manejo de Múltiples Usuarios', () => {
    test('debe manejar 100 usuarios enviando mensajes simultáneamente', async () => {
      const numUsers = 100;
      const messagesPerUser = 5;
      const promises = [];
      const results = new Map();

      // Simular múltiples usuarios enviando mensajes
      for (let userId = 1; userId <= numUsers; userId++) {
        const chatId = `chat_${userId}`;
        results.set(chatId, 0);

        for (let msgNum = 1; msgNum <= messagesPerUser; msgNum++) {
          const promise = new Promise((resolve) => {
            queueService.enqueue(
              chatId,
              async () => {
                results.set(chatId, results.get(chatId) + 1);
                await new Promise(r => setTimeout(r, 1)); // Simular trabajo mínimo
                return `Mensaje ${msgNum} de usuario ${userId}`;
              },
              `Test message ${msgNum} for user ${userId}`
            );
            resolve();
          });
          promises.push(promise);
        }
      }

      await Promise.all(promises);
      
      // Esperar que todas las colas procesen
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar que todos los mensajes fueron procesados
      for (let userId = 1; userId <= numUsers; userId++) {
        const chatId = `chat_${userId}`;
        expect(results.get(chatId)).toBe(messagesPerUser);
      }
    }, 10000);

    test('debe mantener orden de mensajes bajo alta concurrencia', async () => {
      const chatId = 'order_test';
      const numMessages = 50;
      const processedOrder = [];

      // Encolar mensajes secuencialmente
      for (let i = 1; i <= numMessages; i++) {
        queueService.enqueue(
          chatId,
          async () => {
            processedOrder.push(i);
            await new Promise(r => setTimeout(r, Math.random() * 10)); // Simular trabajo variable
          },
          `Order test ${i}`
        );
      }

      // Esperar procesamiento
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verificar orden
      expect(processedOrder).toEqual(Array.from({ length: numMessages }, (_, i) => i + 1));
    }, 5000);
  });

  describe('Manejo de Errores y Recuperación', () => {
    test('debe manejar errores en tareas sin afectar otras colas', async () => {
      const goodChatId = 'good_chat';
      const badChatId = 'bad_chat';
      const goodResults = [];
      const errorResults = [];

      // Tareas que funcionan bien
      for (let i = 1; i <= 5; i++) {
        queueService.enqueue(
          goodChatId,
          async () => {
            goodResults.push(i);
            return `Good task ${i}`;
          },
          `Good task ${i}`
        );
      }

      // Tareas que fallan
      for (let i = 1; i <= 5; i++) {
        queueService.enqueue(
          badChatId,
          async () => {
            if (i === 3) {
              throw new Error(`Error en tarea ${i}`);
            }
            errorResults.push(i);
            return `Bad task ${i}`;
          },
          `Bad task ${i}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Las tareas buenas deben haberse ejecutado completamente
      expect(goodResults).toEqual([1, 2, 3, 4, 5]);
      
      // Las tareas malas deben haber ejecutado excepto la que falló
      expect(errorResults).toEqual([1, 2, 4, 5]);
    });

    test('debe recuperarse de memoria insuficiente simulada', async () => {
      const chatId = 'memory_test';
      let memoryErrorThrown = false;
      let successfulTasks = 0;

      // Simular múltiples tareas, algunas causan error de memoria
      for (let i = 1; i <= 20; i++) {
        queueService.enqueue(
          chatId,
          async () => {
            if (i >= 10 && i <= 12 && !memoryErrorThrown) {
              memoryErrorThrown = true;
              const error = new Error('Insufficient memory');
              error.code = 'ENOMEM';
              throw error;
            }
            successfulTasks++;
            return `Task ${i}`;
          },
          `Memory test ${i}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Debe haberse ejecutado la mayoría de tareas excepto las que fallaron
      expect(successfulTasks).toBeGreaterThanOrEqual(17);
      expect(memoryErrorThrown).toBe(true);
    });
  });

  describe('Rendimiento y Optimización', () => {
    test('debe procesar 1000 tareas rápidas en menos de 2 segundos', async () => {
      const chatId = 'performance_test';
      const numTasks = 1000;
      let processed = 0;

      const startTime = Date.now();

      for (let i = 1; i <= numTasks; i++) {
        queueService.enqueue(
          chatId,
          async () => {
            processed++;
            return `Fast task ${i}`;
          },
          `Performance test ${i}`
        );
      }

      // Esperar hasta que todas las tareas se procesen
      while (processed < numTasks) {
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Timeout de seguridad
        if (Date.now() - startTime > 5000) {
          break;
        }
      }

      const duration = Date.now() - startTime;
      
      expect(processed).toBe(numTasks);
      expect(duration).toBeLessThan(2000);
    }, 6000);

    test('debe mantener uso de memoria estable con colas largas', async () => {
      const chatId = 'memory_stability_test';
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Crear y procesar muchas tareas
      for (let batch = 1; batch <= 10; batch++) {
        for (let i = 1; i <= 100; i++) {
          queueService.enqueue(
            `${chatId}_${batch}`,
            async () => {
              // Simular trabajo que podría crear objetos temporales
              const data = new Array(1000).fill().map((_, idx) => ({ id: idx, value: Math.random() }));
              return data.length;
            },
            `Memory test ${batch}-${i}`
          );
        }
        
        // Esperar procesamiento de lote
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Esperar procesamiento final
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // El aumento de memoria no debe ser excesivo (menos de 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 10000);
  });

  describe('Casos Extremos y Edge Cases', () => {
    test('debe manejar tareas con payloads extremadamente grandes', async () => {
      const chatId = 'large_payload_test';
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB de datos
      let processed = false;

      queueService.enqueue(
        chatId,
        async () => {
          const result = largeData.length;
          processed = true;
          return result;
        },
        'Large payload test'
      );

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(processed).toBe(true);
    });

    test('debe manejar ráfagas de creación y destrucción de colas', async () => {
      const numIterations = 50;
      let totalProcessed = 0;

      for (let iteration = 1; iteration <= numIterations; iteration++) {
        const chatId = `burst_test_${iteration}`;
        
        // Crear múltiples tareas para esta cola
        for (let i = 1; i <= 5; i++) {
          queueService.enqueue(
            chatId,
            async () => {
              totalProcessed++;
              return `Burst ${iteration}-${i}`;
            },
            `Burst test ${iteration}-${i}`
          );
        }

        // Ocasionalmente esperar un poco
        if (iteration % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Esperar procesamiento completo
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(totalProcessed).toBe(numIterations * 5);
    });

    test('debe mantener integridad con interrupciones de red simuladas', async () => {
      const chatId = 'network_interruption_test';
      let processed = 0;
      let networkErrors = 0;

      for (let i = 1; i <= 30; i++) {
        queueService.enqueue(
          chatId,
          async () => {
            // Simular fallo de red ocasional
            if (Math.random() < 0.2) {
              networkErrors++;
              const error = new Error('Network timeout');
              error.code = 'ETIMEDOUT';
              throw error;
            }
            
            processed++;
            await new Promise(r => setTimeout(r, Math.random() * 100));
            return `Network test ${i}`;
          },
          `Network interruption test ${i}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 4000));

      // Debe haberse procesado la mayoría exitosamente
      expect(processed).toBeGreaterThan(20);
      expect(networkErrors).toBeGreaterThan(0);
      expect(processed + networkErrors).toBeLessThanOrEqual(30);
    });
  });

  describe('Métricas y Monitoreo', () => {
    test('debe proporcionar métricas precisas de rendimiento', async () => {
      const chatId = 'metrics_test';
      const numTasks = 20;
      
      const startTime = Date.now();
      
      for (let i = 1; i <= numTasks; i++) {
        queueService.enqueue(
          chatId,
          async () => {
            await new Promise(r => setTimeout(r, 50)); // 50ms de trabajo
            return `Metrics test ${i}`;
          },
          `Metrics test ${i}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const totalTime = Date.now() - startTime;
      
      // Verificar que el tiempo total es razonable (aproximadamente numTasks * 50ms)
      expect(totalTime).toBeGreaterThan(numTasks * 40); // Al menos 40ms por tarea
      expect(totalTime).toBeLessThan(numTasks * 100 + 1000); // Máximo 100ms por tarea + overhead
    });
  });
});