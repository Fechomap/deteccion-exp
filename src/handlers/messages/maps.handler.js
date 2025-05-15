/**
 * Manejador especializado en URLs de Google Maps
 */
const BaseMessageHandler = require('./base.handler');
const Logger = require('../../utils/logger');

class MapsMessageHandler extends BaseMessageHandler {
  /**
   * Verifica si el mensaje contiene una URL de Google Maps
   * @param {Object} msg - Mensaje de Telegram
   * @returns {boolean} - true si puede manejar el mensaje
   */
  canHandle(msg) {
    if (!msg.text) return false;
    
    const text = msg.text;
    return text.includes('google.com/maps') || 
           text.includes('google.com.mx/maps') || 
           text.includes('maps.app.goo.gl');
  }
  
  /**
   * Procesa un mensaje con URL de Google Maps
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async handle(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const { coordinatesUtil, recLocation, config } = this.services;
    
    // Verificar si hay procesamiento de ChatGPT en curso
    if (this.services.processingState?.isProcessingChatGPT(chatId)) {
      Logger.info(`⚠️ Se detectó URL de Google Maps mientras se procesa ChatGPT para chat ${chatId}. Se encolará.`, 'MapsHandler');
      
      await bot.sendMessage(chatId, '⏳ Tu enlace de Google Maps se procesará después de que termine el análisis actual de ChatGPT...')
        .catch(error => Logger.logError('Error al enviar mensaje de espera', error, 'MapsHandler'));
    }
    
    // Encolar el procesamiento
    this.enqueueProcessing(
      chatId,
      async () => await this._processMapUrl(bot, msg),
      'Procesamiento de URL de Google Maps',
      { priority: !this.services.processingState?.isProcessingChatGPT(chatId) }
    );
  }
  
  /**
   * Procesa la extracción de coordenadas y su envío
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {Object} msg - Mensaje de Telegram
   */
  async _processMapUrl(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const { coordinatesUtil, recLocation, config } = this.services;
    
    Logger.info('Procesando enlace de Google Maps, extrayendo coordenadas...', 'MapsHandler');
    
    // Informar que estamos procesando
    const processingMsg = await bot.sendMessage(chatId, '🔄 Procesando enlace de Google Maps...')
      .catch(error => {
        Logger.logError('Error al enviar mensaje de procesamiento', error, 'MapsHandler');
        return null;
      });
    
    // Extraer coordenadas
    const coordinates = coordinatesUtil.extractCoordinates(text);
    
    // Eliminar mensaje de procesamiento si existe
    if (processingMsg) {
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'MapsHandler'));
    }
    
    if (coordinates && coordinates.length > 0) {
      await this._handleFoundCoordinates(bot, msg, coordinates);
    } else {
      await this._handleNoCoordinates(bot, chatId);
    }
  }
  
  /**
   * Maneja el escenario cuando se encuentran coordenadas
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {Object} msg - Mensaje original
   * @param {string[]} coordinates - Coordenadas encontradas
   */
  async _handleFoundCoordinates(bot, msg, coordinates) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const { queue, recLocation, config, serviceCache } = this.services;
    
    // Buscar servicio pendiente para este chat
    const pendingService = this._findPendingServiceForChat(chatId);
    
    if (pendingService) {
      // Actualizar servicio con URL y coordenadas
      const serviceData = serviceCache.getService(pendingService);
      if (serviceData) {
        serviceData.url = text;
        serviceData.coordinates = coordinates;
        serviceCache.storeService(pendingService, serviceData);
        
        // Actualizar mensaje con URL
        const vehicleInfo = serviceData.messages.length > 1 ? serviceData.messages[1] : "No hay información del vehículo";
        const updatedMessage = `🚨 *Nuevo Servicio Disponible*\n\n🚗 *Vehículo:* ${vehicleInfo}\n\n🗺️ [Ver en Google Maps](${text})\n\n¿Desea tomar este servicio?`;
        
        // Actualizar mensaje si existe
        if (serviceData.messageId) {
          await bot.editMessageText(updatedMessage, {
            chat_id: config.TELEGRAM_GROUP_ID,
            message_id: serviceData.messageId,
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: "✅ Tomar Servicio", callback_data: `take_service:${pendingService}` },
                  { text: "❌ Rechazar", callback_data: `reject_service:${pendingService}` }
                ]
              ]
            })
          });
        }
        
        // Solicitar timing
        if (coordinates.length > 0) {
          await recLocation.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
        }
        
        await bot.sendMessage(chatId, '✅ URL y coordenadas agregadas al servicio pendiente.');
      }
    } else {
      // Crear nuevo servicio con solo URL y coordenadas
      const serviceId = `map_${Date.now()}_${chatId}`;
      
      const serviceData = {
        id: serviceId,
        url: text,
        coordinates: coordinates,
        messages: [],
        timestamp: Date.now(),
        origin: chatId
      };
      
      serviceCache.storeService(serviceId, serviceData);
      
      // Mensaje simplificado con URL
      const initialMessage = `🚨 *Nuevo Servicio Disponible*\n\n🗺️ [Ver en Google Maps](${text})\n\n⚠️ *Esperando datos del vehículo*\n\n¿Desea tomar este servicio?`;
      
      // Enviar al grupo
      const sentMessage = await bot.sendMessage(
        config.TELEGRAM_GROUP_ID, 
        initialMessage, 
        { 
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: "✅ Tomar Servicio", callback_data: `take_service:${serviceId}` },
                { text: "❌ Rechazar", callback_data: `reject_service:${serviceId}` }
              ]
            ]
          })
        }
      );
      
      // Guardar ID del mensaje
      serviceData.messageId = sentMessage.message_id;
      serviceCache.storeService(serviceId, serviceData);
      
      // Solicitar timing
      if (coordinates.length > 0) {
        await recLocation.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
      }
      
      await bot.sendMessage(chatId, '✅ URL y coordenadas enviadas. Ahora envía el texto del servicio.');
    }
  }

  // Método auxiliar para encontrar servicios pendientes
  _findPendingServiceForChat(chatId) {
    const { serviceCache } = this.services;
    
    // Buscar en los servicios almacenados
    for (const [serviceId, data] of serviceCache.serviceCache.entries()) {
      if (data.origin === chatId && 
          Date.now() - data.timestamp < 30 * 60 * 1000 && // Menos de 30 minutos
          (!data.url || !data.coordinates || data.messages.length === 0)) {
        return serviceId;
      }
    }
    
    return null;
  }
  
  /**
   * Maneja el escenario cuando no se encuentran coordenadas
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {string} chatId - ID del chat
   */
  async _handleNoCoordinates(bot, chatId) {
    Logger.info('No se encontraron coordenadas en el enlace', 'MapsHandler');
    await bot.sendMessage(chatId, 'No pude encontrar coordenadas en el enlace proporcionado.')
      .catch(error => Logger.logError('Error al enviar mensaje', error, 'MapsHandler'));
  }
}

module.exports = MapsMessageHandler;