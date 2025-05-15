/**
 * Servicio para procesar colas de mensajes
 */
const Logger = require('../../utils/logger');
const ChatUtils = require('../../utils/chat');

class ProcessorService {
  constructor(queueService) {
    this.queueService = queueService;
    
    // Configuración
    this.MAX_RETRIES = 3;      // Número máximo de reintentos
    this.RETRY_DELAY = 1000;   // Tiempo entre reintentos en ms
    this.MESSAGE_DELAY = 200;  // Tiempo entre mensajes consecutivos en ms
    
    Logger.info('Procesador de cola inicializado', 'ProcessorService');
  }
  
  /**
   * Inicia el procesamiento de la cola para un chat
   * @param {string|number} chatId - ID del chat
   */
  async startProcessing(chatId) {
    // Si ya está procesando, no hacer nada
    if (this.queueService.isProcessing(chatId)) return;
    
    // Si no hay mensajes en la cola, no hacer nada
    if (this.queueService.getQueueLength(chatId) === 0) return;
    
    // Marcar como procesando
    this.queueService.setProcessing(chatId);
    
    try {
      await this._processNextMessage(chatId);
    } catch (error) {
      Logger.logError(`Error crítico al procesar cola para chat ${chatId}`, error, 'ProcessorService');
      // A pesar del error, marcar como libre para no bloquear la cola
      this.queueService.clearProcessing(chatId);
    }
  }
  
  /**
   * Procesa el siguiente mensaje en la cola
   * @private
   * @param {string|number} chatId - ID del chat
   */
  async _processNextMessage(chatId) {
    // Obtener el siguiente mensaje
    const message = this.queueService.dequeue(chatId);
    
    if (!message) {
      // No hay más mensajes, marcar como libre
      this.queueService.clearProcessing(chatId);
      return;
    }
    
    Logger.info(`Procesando mensaje para chat ${chatId}: ${message.description}. Restantes en cola: ${this.queueService.getQueueLength(chatId)}`, 'ProcessorService');
    
    try {
      // Ejecutar el manejador del mensaje con reintentos
      await this._executeWithRetries(message.handler, message, chatId);
      
      // Pausa entre mensajes para respetar los límites de Telegram
      await this._delay(this.MESSAGE_DELAY);
      
      // Procesar el siguiente mensaje si hay más
      if (this.queueService.getQueueLength(chatId) > 0) {
        await this._processNextMessage(chatId);
      } else {
        // No hay más mensajes, marcar como libre
        this.queueService.clearProcessing(chatId);
      }
    } catch (error) {
      Logger.logError(`Error persistente al procesar mensaje para chat ${chatId}: ${message.description}`, error, 'ProcessorService');
      
      // A pesar del error, continuamos con el siguiente mensaje
      if (this.queueService.getQueueLength(chatId) > 0) {
        await this._processNextMessage(chatId);
      } else {
        this.queueService.clearProcessing(chatId);
      }
    }
  }
  
  /**
   * Ejecuta una función con reintentos automáticos
   * @private
   * @param {Function} handler - Función a ejecutar
   * @param {Object} message - Mensaje que se está procesando
   * @param {string|number} chatId - ID del chat
   * @returns {Promise} - Promesa que se resuelve cuando la función se ejecuta con éxito
   */
  async _executeWithRetries(handler, message, chatId) {
    try {
      return await ChatUtils.withRetry(
        handler,
        this.MAX_RETRIES,
        this.RETRY_DELAY
      );
    } catch (error) {
      // Si fallaron todos los reintentos, registrar el error
      Logger.logError(`Agotados todos los reintentos (${this.MAX_RETRIES}) para: ${message.description}`, error, 'ProcessorService');
      throw error;
    }
  }
  
  /**
   * Bloquea temporalmente la recepción de nuevos mensajes para un chat
   * @param {string|number} chatId - ID del chat
   * @param {number} timeoutMs - Tiempo de bloqueo en milisegundos
   * @returns {Promise} - Promesa que se resuelve cuando termina el bloqueo
   */
  async blockTemporarily(chatId, timeoutMs = 10000) {
    this.queueService.setProcessing(chatId);
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.queueService.clearProcessing(chatId);
        resolve();
      }, timeoutMs);
    });
  }
  
  /**
   * Crea un retraso utilizando Promise
   * @private
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise} - Promesa que se resuelve después del tiempo especificado
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProcessorService;