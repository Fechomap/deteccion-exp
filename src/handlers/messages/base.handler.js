/**
 * Clase base para manejadores de mensajes
 */
const Logger = require('../../utils/logger');

class BaseMessageHandler {
  /**
   * Constructor para la clase base de manejadores
   * @param {Object} services - Servicios inyectados
   */
  constructor(services) {
    if (this.constructor === BaseMessageHandler) {
      throw new Error('BaseMessageHandler es una clase abstracta y no puede ser instanciada directamente');
    }

    this.logger = Logger;
    this.services = services;
  }

  /**
   * Determina si este manejador puede procesar el mensaje
   * @param {Object} msg - Mensaje de Telegram
   * @returns {boolean} - true si puede manejar el mensaje
   */
  canHandle(msg) {
    throw new Error('El método canHandle debe ser implementado por las subclases');
  }

  /**
   * Procesa el mensaje
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   * @returns {Promise} - Promesa que se resuelve cuando se completa el procesamiento
   */
  async handle(bot, msg) {
    throw new Error('El método handle debe ser implementado por las subclases');
  }

  /**
   * Encola el procesamiento de un mensaje
   * @param {string} chatId - ID del chat
   * @param {Function} handlerFn - Función de manejo
   * @param {string} description - Descripción para logs
   * @param {Object} options - Opciones adicionales
   */
  enqueueProcessing(chatId, handlerFn, description, options = {}) {
    this.services.queue.enqueue(chatId, handlerFn, description, options);
  }
}

module.exports = BaseMessageHandler;
