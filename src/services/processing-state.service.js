/**
 * Servicio para gestionar el estado de procesamiento de los chats
 */
const Logger = require('../utils/logger');

class ProcessingStateService {
  constructor() {
    // Mapa para almacenar el estado de procesamiento de ChatGPT por chatId
    this.processingChatGPT = new Map();
    
    Logger.info('Servicio de estado de procesamiento inicializado', 'ProcessingState');
  }
  
  /**
   * Verifica si un chat está procesando con ChatGPT
   * @param {string|number} chatId - ID del chat
   * @returns {boolean} - true si está procesando con ChatGPT
   */
  isProcessingChatGPT(chatId) {
    return this.processingChatGPT.get(chatId) === true;
  }
  
  /**
   * Establece el estado de procesamiento de ChatGPT para un chat
   * @param {string|number} chatId - ID del chat
   * @param {boolean} value - Nuevo estado
   */
  setProcessingChatGPT(chatId, value) {
    this.processingChatGPT.set(chatId, value);
    Logger.info(`Chat ${chatId} procesamiento ChatGPT: ${value ? 'INICIADO' : 'FINALIZADO'}`, 'ProcessingState');
  }
  
  /**
   * Limpia el estado de procesamiento de ChatGPT para un chat
   * @param {string|number} chatId - ID del chat
   */
  clearProcessingChatGPT(chatId) {
    this.processingChatGPT.delete(chatId);
    Logger.info(`Estado de procesamiento de ChatGPT limpiado para chat ${chatId}`, 'ProcessingState');
  }
}

// Exportar una instancia única del servicio
module.exports = new ProcessingStateService();