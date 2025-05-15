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
    const { queue, config, serviceCache } = this.services;
    
    // Generar ID único para este servicio
    const serviceId = `service_${Date.now()}_${chatId}`;
    
    if (config.TELEGRAM_GROUP_ID && messages.length > 0) {
      try {
        // Almacenar todos los datos en el caché
        const serviceData = {
          id: serviceId,
          messages: messages,
          timestamp: Date.now(),
          origin: chatId
        };
        
        serviceCache.storeService(serviceId, serviceData);
        
        // Obtener solo la información del vehículo (segundo mensaje)
        const vehicleInfo = messages.length > 1 ? messages[1] : "No hay información del vehículo";
        
        // Crear mensaje con solo la información clave y botones
        const initialMessage = `🚨 *Nuevo Servicio Disponible*\n\n🚗 *Vehículo:* ${vehicleInfo}\n\n¿Desea tomar este servicio?`;
        
        // Botones de acción
        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "✅ Tomar Servicio", callback_data: `take_service:${serviceId}` },
              { text: "❌ Rechazar", callback_data: `reject_service:${serviceId}` }
            ]
          ]
        };
        
        // Enviar mensaje inicial
        queue.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(
              config.TELEGRAM_GROUP_ID, 
              initialMessage, 
              { 
                parse_mode: 'Markdown',
                reply_markup: JSON.stringify(inlineKeyboard)
              }
            );
          },
          'Envío de mensaje inicial simplificado',
          { priority: true }
        );
        
        // Confirmación al usuario
        await bot.sendMessage(chatId, '✅ Datos enviados correctamente al grupo de control.');
        
      } catch (error) {
        Logger.logError('Error al enviar datos simplificados', error, 'ServiceHandler');
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