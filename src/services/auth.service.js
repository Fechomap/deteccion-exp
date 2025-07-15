/**
 * Servicio de autenticación para validar acceso al bot
 */
const config = require('../config');

class AuthService {
  constructor() {
    this.allowedChatIds = config.ALLOWED_CHAT_IDS;
  }

  /**
   * Verifica si un chat ID está autorizado para usar el bot
   * @param {string|number} chatId - ID del chat a validar
   * @returns {boolean} - true si está autorizado, false en caso contrario
   */
  isAuthorized(chatId) {
    if (!chatId) return false;

    const chatIdStr = chatId.toString();
    return this.allowedChatIds.includes(chatIdStr);
  }

  /**
   * Middleware para validar autorización en mensajes de Telegram
   * @param {Object} msg - Mensaje de Telegram
   * @returns {boolean} - true si está autorizado, false en caso contrario
   */
  validateMessage(msg) {
    if (!msg || !msg.chat) return false;
    return this.isAuthorized(msg.chat.id);
  }

  /**
   * Middleware para validar autorización en callbacks de Telegram
   * @param {Object} query - Callback query de Telegram
   * @returns {boolean} - true si está autorizado, false en caso contrario
   */
  validateCallback(query) {
    if (!query || !query.message || !query.message.chat) return false;
    return this.isAuthorized(query.message.chat.id);
  }

  /**
   * Obtiene los chat IDs autorizados
   * @returns {Array} - Lista de chat IDs autorizados
   */
  getAllowedChatIds() {
    return [...this.allowedChatIds];
  }
}

module.exports = new AuthService();
