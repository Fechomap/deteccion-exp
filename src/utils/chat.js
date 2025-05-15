/**
 * Utilidades relacionadas con chats de Telegram
 */

/**
 * Obtiene información detallada del chat y el remitente
 * @param {Object} msg - Mensaje de Telegram
 * @returns {Object} - Información del chat y del remitente
 */
function getChatInfo(msg) {
  const chat = msg.chat;
  const from = msg.from || {};
  const chatType = chat.type || 'desconocido';
  
  // Construir información del chat
  let chatInfo = {
    id: chat.id,
    type: chatType,
    title: chat.title || 'N/A',
    username: chat.username || 'N/A',
    firstName: chat.first_name || 'N/A',
    lastName: chat.last_name || 'N/A'
  };
  
  // Construir información del remitente
  let fromInfo = {
    id: from.id || 'N/A',
    username: from.username || 'N/A',
    firstName: from.first_name || 'N/A',
    lastName: from.last_name || 'N/A'
  };
  
  return { chat: chatInfo, from: fromInfo };
}

/**
 * Función para enviar un mensaje al usuario original y también al grupo (si está configurado)
 * @param {TelegramBot} bot - Instancia del bot
 * @param {number} userChatId - ID del chat del usuario
 * @param {string} message - Mensaje a enviar
 * @param {string} groupChatId - ID del chat del grupo
 * @param {boolean} sendToGroup - Si debe enviarse al grupo
 * @returns {Promise} - Promesa que se resuelve cuando ambos mensajes han sido enviados
 */
async function sendMessageToUserAndGroup(bot, userChatId, message, groupChatId, sendToGroup = true) {
  const Logger = require('./logger');
  try {
    // Enviar al usuario
    await bot.sendMessage(userChatId, message);
    Logger.info(`Mensaje enviado a usuario ${userChatId}: ${message}`, 'ChatUtils');
    
    // Enviar al grupo si está configurado
    if (sendToGroup && groupChatId) {
      await bot.sendMessage(groupChatId, message);
      Logger.info(`Mensaje enviado al grupo ${groupChatId}: ${message}`, 'ChatUtils');
    }
  } catch (error) {
    Logger.logError('Error al enviar mensaje', error, 'ChatUtils');
    throw error;
  }
}

/**
 * Función para reintento de operaciones
 * @param {Function} fn - Función a ejecutar con reintento
 * @param {number} retries - Número de reintentos
 * @param {number} delay - Retraso entre reintentos en ms
 * @returns {Promise} - Resultado de la función
 */
async function withRetry(fn, retries = 3, delay = 2000) {
  const Logger = require('./logger');
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    Logger.warn(`Reintentando operación después de ${delay}ms. Intentos restantes: ${retries}`, 'ChatUtils');
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5);
  }
}

module.exports = {
  getChatInfo,
  sendMessageToUserAndGroup,
  withRetry
};