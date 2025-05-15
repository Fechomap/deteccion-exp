/**
 * Servicio básico de cola de mensajes
 */
const Logger = require('../../utils/logger');

class QueueService {
  constructor() {
    this.messageQueues = new Map();
    this.processingStatus = new Map();
    
    Logger.info('Servicio de cola inicializado', 'QueueService');
  }
  
  /**
   * Verifica si un chat está actualmente procesando un mensaje
   * @param {string|number} chatId - ID del chat
   * @returns {boolean} - true si el chat está procesando un mensaje
   */
  isProcessing(chatId) {
    return this.processingStatus.get(chatId) === true;
  }
  
  /**
   * Marca un chat como en procesamiento
   * @param {string|number} chatId - ID del chat
   */
  setProcessing(chatId) {
    this.processingStatus.set(chatId, true);
    Logger.info(`Chat ${chatId} marcado como en procesamiento`, 'QueueService');
  }
  
  /**
   * Marca un chat como libre (no en procesamiento)
   * @param {string|number} chatId - ID del chat
   */
  clearProcessing(chatId) {
    this.processingStatus.set(chatId, false);
    Logger.info(`Chat ${chatId} marcado como libre`, 'QueueService');
  }
  
  /**
   * Añade un mensaje a la cola para un chat específico
   * @param {string|number} chatId - ID del chat
   * @param {Function} messageHandler - Función que maneja el envío del mensaje
   * @param {string} description - Descripción del mensaje para logs
   * @param {Object} options - Opciones adicionales
   */
  enqueue(chatId, messageHandler, description, options = {}) {
    // Inicializar la cola si no existe
    if (!this.messageQueues.has(chatId)) {
      this.messageQueues.set(chatId, []);
    }
    
    const queue = this.messageQueues.get(chatId);
    const message = { 
      handler: messageHandler, 
      description,
      groupId: options.groupId || null,
      priority: options.priority || false,
      retries: 0
    };
    
    // Añadir el manejador a la cola
    if (message.priority) {
      // Los mensajes prioritarios van al principio
      queue.unshift(message);
      Logger.info(`Mensaje PRIORITARIO encolado para chat ${chatId}: ${description}. Total en cola: ${queue.length}`, 'QueueService');
    } else {
      queue.push(message);
      Logger.info(`Mensaje encolado para chat ${chatId}: ${description}. Total en cola: ${queue.length}`, 'QueueService');
    }
    
    return message;
  }
  
  /**
   * Obtiene y elimina el siguiente mensaje de la cola
   * @param {string|number} chatId - ID del chat
   * @returns {Object|null} - Siguiente mensaje en la cola o null si está vacía
   */
  dequeue(chatId) {
    if (!this.messageQueues.has(chatId)) return null;
    
    const queue = this.messageQueues.get(chatId);
    if (queue.length === 0) return null;
    
    return queue.shift();
  }
  
  /**
   * Obtiene la longitud actual de la cola para un chat
   * @param {string|number} chatId - ID del chat
   * @returns {number} - Número de mensajes en cola
   */
  getQueueLength(chatId) {
    if (!this.messageQueues.has(chatId)) return 0;
    return this.messageQueues.get(chatId).length;
  }
  
  /**
   * Limpia la cola de mensajes para un chat
   * @param {string|number} chatId - ID del chat
   */
  clearQueue(chatId) {
    if (this.messageQueues.has(chatId)) {
      const queueLength = this.messageQueues.get(chatId).length;
      this.messageQueues.set(chatId, []);
      Logger.info(`Cola limpiada para chat ${chatId}. Se eliminaron ${queueLength} mensajes pendientes.`, 'QueueService');
    }
    this.clearProcessing(chatId);
  }
}

module.exports = QueueService;