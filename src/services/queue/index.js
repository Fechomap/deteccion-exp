/**
 * Fachada unificada para el sistema de cola
 */
const QueueService = require('./queue.service');
const GroupService = require('./group.service');
const ProcessorService = require('./processor.service');
const Logger = require('../../utils/logger');

class MessageQueueFacade {
  constructor() {
    // Inicializar componentes
    this.queueService = new QueueService();
    this.groupService = new GroupService(this.queueService);
    this.processorService = new ProcessorService(this.queueService);
    
    Logger.info('Sistema de cola de mensajes inicializado completamente', 'MessageQueue');
  }
  
  /**
   * Añade un mensaje a la cola para un chat específico
   * @param {string|number} chatId - ID del chat
   * @param {Function} messageHandler - Función que maneja el envío del mensaje
   * @param {string} description - Descripción del mensaje para logs
   * @param {Object} options - Opciones adicionales
   */
  enqueue(chatId, messageHandler, description, options = {}) {
    // Si es parte de un grupo, delegarlo al servicio de grupos
    if (options.groupId) {
      const message = { 
        handler: messageHandler, 
        description,
        groupId: options.groupId,
        priority: options.priority || false
      };
      
      this.groupService.addToGroup(options.groupId, message);
      return;
    }
    
    // Si no es parte de un grupo, añadirlo a la cola normal
    this.queueService.enqueue(chatId, messageHandler, description, options);
    
    // Iniciar el procesamiento si no está en curso
    this.processorService.startProcessing(chatId);
  }
  
  /**
   * Marca un grupo de mensajes como completo y los agrega a la cola
   * @param {string} groupId - ID del grupo
   * @param {string|number} chatId - ID del chat donde se enviará
   * @param {boolean} priority - Si el grupo tiene alta prioridad
   */
  completeGroup(groupId, chatId, priority = false) {
    this.groupService.completeGroup(groupId, chatId, priority);
    
    // Iniciar el procesamiento
    this.processorService.startProcessing(chatId);
  }
  
  /**
   * Verifica si un chat está actualmente procesando un mensaje
   * @param {string|number} chatId - ID del chat
   * @returns {boolean} - true si el chat está procesando un mensaje
   */
  isProcessing(chatId) {
    return this.queueService.isProcessing(chatId);
  }
  
  /**
   * Obtiene la longitud actual de la cola para un chat
   * @param {string|number} chatId - ID del chat
   * @returns {number} - Número de mensajes en cola
   */
  getQueueLength(chatId) {
    return this.queueService.getQueueLength(chatId);
  }
  
  /**
   * Obtiene información sobre los grupos pendientes
   * @returns {Object} - Información sobre los grupos
   */
  getPendingGroupsInfo() {
    return this.groupService.getPendingGroupsInfo();
  }
  
  /**
   * Limpia la cola de mensajes para un chat
   * @param {string|number} chatId - ID del chat
   */
  clearQueue(chatId) {
    this.queueService.clearQueue(chatId);
  }
  
  /**
   * Bloquea temporalmente la recepción de nuevos mensajes para un chat
   * @param {string|number} chatId - ID del chat
   * @param {number} timeoutMs - Tiempo de bloqueo en milisegundos
   * @returns {Promise} - Promesa que se resuelve cuando termina el bloqueo
   */
  async blockTemporarily(chatId, timeoutMs = 10000) {
    return this.processorService.blockTemporarily(chatId, timeoutMs);
  }
}

// Exportar una instancia única del servicio
module.exports = new MessageQueueFacade();