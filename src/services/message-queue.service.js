/**
 * Servicio de cola de mensajes para garantizar el orden correcto de los mensajes
 */
const Logger = require('../utils/logger');
const ChatUtils = require('../utils/chat');

class MessageQueueService {
  constructor() {
    // Mapas para almacenar las colas de mensajes y los estados de procesamiento
    this.messageQueues = new Map();
    this.processingStatus = new Map();
    this.priorityGroups = new Map(); // Para agrupar mensajes que deben enviarse juntos
    
    // Configuración 
    this.MAX_RETRIES = 3;           // Número máximo de reintentos
    this.RETRY_DELAY = 1000;        // Tiempo entre reintentos en ms
    this.MESSAGE_DELAY = 200;       // Tiempo entre mensajes consecutivos en ms
    this.GROUP_MESSAGE_DELAY = 50;  // Tiempo entre mensajes agrupados en ms
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
    Logger.info(`Chat ${chatId} marcado como en procesamiento`, 'MessageQueue');
  }

  /**
   * Marca un chat como libre (no en procesamiento)
   * @param {string|number} chatId - ID del chat
   */
  clearProcessing(chatId) {
    this.processingStatus.set(chatId, false);
    Logger.info(`Chat ${chatId} marcado como libre`, 'MessageQueue');
    
    // Procesar la cola de mensajes pendientes
    this._processQueue(chatId);
  }

  /**
   * Añade un mensaje a la cola para un chat específico
   * @param {string|number} chatId - ID del chat
   * @param {Function} messageHandler - Función que maneja el envío del mensaje
   * @param {string} description - Descripción del mensaje para logs
   * @param {Object} options - Opciones adicionales
   * @param {string} options.groupId - ID del grupo de mensajes (para agruparlos)
   * @param {boolean} options.priority - Si es un mensaje de alta prioridad
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
    
    // Si es parte de un grupo, registrarlo en el mapa de grupos
    if (message.groupId) {
      if (!this.priorityGroups.has(message.groupId)) {
        this.priorityGroups.set(message.groupId, []);
      }
      this.priorityGroups.get(message.groupId).push(message);
      
      Logger.info(`Mensaje agregado al grupo ${message.groupId}: ${description}`, 'MessageQueue');
      return; // No procesar aún, se procesará cuando se complete el grupo
    }
    
    // Añadir el manejador a la cola
    if (message.priority) {
      // Los mensajes prioritarios van al principio
      queue.unshift(message);
      Logger.info(`Mensaje PRIORITARIO encolado para chat ${chatId}: ${description}. Total en cola: ${queue.length}`, 'MessageQueue');
    } else {
      queue.push(message);
      Logger.info(`Mensaje encolado para chat ${chatId}: ${description}. Total en cola: ${queue.length}`, 'MessageQueue');
    }
    
    // Si no hay procesamiento activo, procesar inmediatamente
    if (!this.isProcessing(chatId)) {
      this._processQueue(chatId);
    }
  }

  /**
   * Marca un grupo de mensajes como completo y los agrega a la cola
   * @param {string} groupId - ID del grupo
   * @param {string|number} chatId - ID del chat donde se enviará
   * @param {boolean} priority - Si el grupo tiene alta prioridad
   */
  completeGroup(groupId, chatId, priority = false) {
    if (!this.priorityGroups.has(groupId)) {
      Logger.warn(`No se encontró el grupo ${groupId} para completar`, 'MessageQueue');
      return;
    }
    
    // Inicializar la cola si no existe
    if (!this.messageQueues.has(chatId)) {
      this.messageQueues.set(chatId, []);
    }
    
    const queue = this.messageQueues.get(chatId);
    const groupMessages = this.priorityGroups.get(groupId);
    
    // Agregar el grupo completo como un solo elemento en la cola
    const groupHandler = async () => {
      Logger.info(`Procesando grupo de mensajes ${groupId} (${groupMessages.length} mensajes)`, 'MessageQueue');
      
      for (const message of groupMessages) {
        try {
          // Ejecutar cada manejador con un pequeño retraso entre ellos
          await message.handler();
          await this._delay(this.GROUP_MESSAGE_DELAY);
        } catch (error) {
          Logger.logError(`Error al procesar mensaje en grupo ${groupId}: ${message.description}`, error, 'MessageQueue');
          // Continuamos con el siguiente mensaje a pesar del error
        }
      }
    };
    
    // Crear un mensaje que representa al grupo completo
    const groupMessage = {
      handler: groupHandler,
      description: `Grupo de mensajes ${groupId} (${groupMessages.length} mensajes)`,
      priority: priority,
      retries: 0
    };
    
    // Añadir el grupo a la cola con la prioridad correcta
    if (priority) {
      queue.unshift(groupMessage);
    } else {
      queue.push(groupMessage);
    }
    
    Logger.info(`Grupo ${groupId} completado y agregado a la cola. Total en cola: ${queue.length}`, 'MessageQueue');
    
    // Eliminar el grupo ya que se ha agregado a la cola
    this.priorityGroups.delete(groupId);
    
    // Si no hay procesamiento activo, procesar inmediatamente
    if (!this.isProcessing(chatId)) {
      this._processQueue(chatId);
    }
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

  /**
   * Procesa la cola de mensajes para un chat específico
   * @private
   * @param {string|number} chatId - ID del chat
   */
  async _processQueue(chatId) {
    // Si no hay cola para este chat, no hacer nada
    if (!this.messageQueues.has(chatId)) return;
    
    const queue = this.messageQueues.get(chatId);
    
    // Si la cola está vacía, no hacer nada
    if (queue.length === 0) return;
    
    // Marcar como procesando
    this.setProcessing(chatId);
    
    try {
      // Obtener el primer mensaje de la cola
      const message = queue.shift();
      Logger.info(`Procesando mensaje para chat ${chatId}: ${message.description}. Restantes en cola: ${queue.length}`, 'MessageQueue');
      
      try {
        // Ejecutar el manejador del mensaje con reintentos
        await this._executeWithRetries(message.handler, message, chatId);
        
        // Pausa entre mensajes para respetar los límites de Telegram
        await this._delay(this.MESSAGE_DELAY);
        
        // Si hay más mensajes en la cola, continuar procesando
        if (queue.length > 0) {
          this._processQueue(chatId);
        } else {
          // Si no hay más mensajes, marcar como libre
          this.clearProcessing(chatId);
        }
      } catch (error) {
        Logger.logError(`Error persistente al procesar mensaje para chat ${chatId}: ${message.description}`, error, 'MessageQueue');
        
        // A pesar del error, continuamos con el siguiente mensaje para no bloquear la cola
        if (queue.length > 0) {
          this._processQueue(chatId);
        } else {
          this.clearProcessing(chatId);
        }
      }
    } catch (error) {
      Logger.logError(`Error crítico al procesar cola para chat ${chatId}`, error, 'MessageQueue');
      // A pesar del error, marcar como libre para no bloquear la cola
      this.clearProcessing(chatId);
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
      Logger.logError(`Agotados todos los reintentos (${this.MAX_RETRIES}) para: ${message.description}`, error, 'MessageQueue');
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
    this.setProcessing(chatId);
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.clearProcessing(chatId);
        resolve();
      }, timeoutMs);
    });
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
   * Obtiene información sobre los grupos pendientes
   * @returns {Object} - Información sobre los grupos
   */
  getPendingGroupsInfo() {
    const groupInfo = {};
    for (const [groupId, messages] of this.priorityGroups.entries()) {
      groupInfo[groupId] = messages.length;
    }
    return groupInfo;
  }

  /**
   * Limpia la cola de mensajes para un chat
   * @param {string|number} chatId - ID del chat
   */
  clearQueue(chatId) {
    if (this.messageQueues.has(chatId)) {
      const queueLength = this.messageQueues.get(chatId).length;
      this.messageQueues.set(chatId, []);
      Logger.info(`Cola limpiada para chat ${chatId}. Se eliminaron ${queueLength} mensajes pendientes.`, 'MessageQueue');
    }
    this.clearProcessing(chatId);
  }
}

// Exportar una instancia única del servicio
module.exports = new MessageQueueService();