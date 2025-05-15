/**
 * Manejador especializado en texto de servicios
 */
const BaseMessageHandler = require('./base.handler');
const Logger = require('../../utils/logger');

class ServiceMessageHandler extends BaseMessageHandler {
  /**
   * Verifica si el mensaje contiene texto de servicio
   * @param {Object} msg - Mensaje de Telegram
   * @returns {boolean} - true si puede manejar el mensaje
   */
  canHandle(msg) {
    if (!msg.text) return false;
    
    const text = msg.text;
    return text.length > 200 && 
          (text.includes('GRUAS') || 
           text.includes('Servicio') || 
           text.includes('Vehículo'));
  }
  
  /**
   * Procesa un mensaje con texto de servicio
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async handle(bot, msg) {
    const chatId = msg.chat.id;
    const { processingState } = this.services;
    
    // Marcar este chat como en procesamiento de ChatGPT
    if (processingState) {
      processingState.setProcessingChatGPT(chatId, true);
      Logger.info(`⏳ Iniciando procesamiento de ChatGPT para chat ${chatId}`, 'ServiceHandler');
    }
    
    // Encolar el procesamiento con alta prioridad
    this.enqueueProcessing(
      chatId,
      async () => {
        await this._processServiceText(bot, msg);
        
        // Después de procesar, limpiar el estado
        if (processingState) {
          processingState.setProcessingChatGPT(chatId, false);
          Logger.info(`✅ Procesamiento de ChatGPT completado para chat ${chatId}`, 'ServiceHandler');
        }
      },
      'Procesamiento de texto de servicio con ChatGPT',
      { priority: true }
    );
  }
  
  /**
   * Procesa el texto de servicio con OpenAI
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {Object} msg - Mensaje de Telegram
   */
  async _processServiceText(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const { openai, queue, config } = this.services;
    
    Logger.info('Iniciando procesamiento de texto con ChatGPT...', 'ServiceHandler');
    
    // Notificar que estamos procesando
    const processingMsg = await bot.sendMessage(chatId, '🧠 Procesando texto con ChatGPT... esto puede tomar unos segundos ⏳')
      .catch(error => {
        Logger.logError('Error al enviar mensaje de procesamiento', error, 'ServiceHandler');
        return null;
      });
    
    if (!processingMsg) return;
    
    try {
      // Procesar el texto usando ChatGPT
      const extractedData = await openai.parseServiceText(text);
      Logger.info(`Datos extraídos: ${JSON.stringify(extractedData)}`, 'ServiceHandler');
      
      // Formatear los datos para enviar
      const messages = openai.formatDataToMessages(extractedData);
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'ServiceHandler'));
      
      // Manejar el envío de los datos extraídos
      await this._handleExtractedData(bot, chatId, messages);
    } catch (error) {
      Logger.logError('Error al procesar el texto con ChatGPT', error, 'ServiceHandler');
      
      // Eliminar mensaje de procesamiento
      if (processingMsg) {
        await bot.deleteMessage(chatId, processingMsg.message_id)
          .catch(err => Logger.logError('Error al eliminar mensaje de procesamiento', err, 'ServiceHandler'));
      }
      
      // Informar del error
      await bot.sendMessage(chatId, `❌ Error al procesar el texto: ${error.message}`)
        .catch(err => Logger.logError('Error al enviar mensaje de error', err, 'ServiceHandler'));
    }
  }
  
  /**
   * Maneja los datos extraídos y los envía
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {string} chatId - ID del chat
   * @param {string[]} messages - Mensajes a enviar
   */
  async _handleExtractedData(bot, chatId, messages) {
    const { queue, config } = this.services;
    
    // Generar ID único para este grupo de mensajes
    const serviceGroupId = `service_${Date.now()}_${chatId}`;
    
    // Enviar mensajes al grupo si está configurado
    if (config.TELEGRAM_GROUP_ID && messages.length > 0) {
      try {
        // Encolar alertas iniciales
        queue.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚨👀 Oigan...'),
          'Alerta inicial',
          { groupId: serviceGroupId }
        );
        
        queue.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⚠️📍 Hay un posible servicio de *CHUBB*', { parse_mode: 'Markdown' }),
          'Alerta CHUBB',
          { groupId: serviceGroupId }
        );
        
        queue.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚗💨 ¿A alguien le queda?', { parse_mode: 'Markdown' }),
          'Pregunta disponibilidad',
          { groupId: serviceGroupId }
        );
        
        // Encolar cada mensaje de datos
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          queue.enqueue(
            config.TELEGRAM_GROUP_ID,
            async () => await bot.sendMessage(config.TELEGRAM_GROUP_ID, message),
            `Dato ${i+1}: ${message.substr(0, 30)}${message.length > 30 ? '...' : ''}`,
            { groupId: serviceGroupId }
          );
        }
        
        // Completar el grupo para procesamiento atómico
        queue.completeGroup(serviceGroupId, config.TELEGRAM_GROUP_ID, true);
        
        // Enviar confirmación al usuario
        await bot.sendMessage(chatId, '✅ Los datos del vehículo han sido enviados correctamente al grupo de control.');
        Logger.info('Datos extraídos enviados exitosamente', 'ServiceHandler');
      } catch (error) {
        Logger.logError('Error al enviar datos extraídos', error, 'ServiceHandler');
        await bot.sendMessage(chatId, `❌ Error al enviar los datos: ${error.message}`);
      }
    } else if (messages.length > 0) {
      // Si no hay grupo configurado, enviar al usuario directamente
      await bot.sendMessage(chatId, '📋 *Datos extraídos:*', { parse_mode: 'Markdown' });
      
      for (const message of messages) {
        await bot.sendMessage(chatId, message);
      }
    } else {
      await bot.sendMessage(chatId, "❌ No se pudo extraer información del texto.");
    }
  }
}

module.exports = ServiceMessageHandler;