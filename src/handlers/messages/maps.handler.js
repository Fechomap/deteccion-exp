// src/handlers/messages/maps.handler.js
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
    const { queue, recLocation, config } = this.services;
    const serviceCache = this.services.serviceCache;
    
    // Verificar si hay caché disponible
    if (serviceCache) {
      try {
        // Buscar servicio pendiente para este chat
        const pendingService = this._findPendingServiceForChat(chatId);
        
        if (pendingService) {
          // Existe un servicio pendiente, actualizar con URL
          const serviceData = serviceCache.getService(pendingService);
          if (serviceData) {
            serviceData.url = text;
            serviceData.coordinates = coordinates;
            serviceData.hasUrl = true;
            serviceCache.storeService(pendingService, serviceData);
            
            // Actualizar mensaje con URL Y BOTONES INMEDIATAMENTE
            const vehicleInfo = serviceData.messages && serviceData.messages.length > 1 ? 
                                serviceData.messages[1] : "No hay información del vehículo";
            
            // CAMBIO: Mensaje con botones inmediatamente después de la URL
            const updatedMessage = `🚨 *Nuevo Servicio Disponible*\n\n` +
                                  `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
                                  `🗺️ [Ver en Google Maps](${text})\n\n` +
                                  `¿Desea tomar este servicio?`;
            
            // Botones de acción
            const inlineKeyboard = {
              inline_keyboard: [
                [
                  { text: "✅ Tomar Servicio", callback_data: `take_service:${serviceData.id}` },
                  { text: "❌ Rechazar", callback_data: `reject_service:${serviceData.id}` }
                ]
              ]
            };
            
            // Actualizar mensaje si existe ID
            if (serviceData.messageId) {
              try {
                await bot.editMessageText(updatedMessage, {
                  chat_id: config.TELEGRAM_GROUP_ID,
                  message_id: serviceData.messageId,
                  parse_mode: 'Markdown',
                  disable_web_page_preview: false,
                  reply_markup: inlineKeyboard // Botones inmediatos
                });
                
                Logger.info(`Mensaje actualizado con URL y botones para servicio ${pendingService}`, 'MapsHandler');
              } catch (editError) {
                Logger.logError('Error al editar mensaje', editError, 'MapsHandler');
              }
            }
            
            // Solicitar timing en segundo plano (ya no esperamos por él para mostrar botones)
            if (coordinates.length > 0) {
              // Ya no marcamos como esperando timing, pues los botones ya están mostrados
              Logger.info(`Solicitando timing para coordenadas ${coordinates[0]} (en segundo plano)`, 'MapsHandler');
              
              try {
                // Solicitar timing pero ya no dependemos de él para actualizar la UI
                await recLocation.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
                Logger.info(`Timing solicitado exitosamente para servicio ${pendingService}`, 'MapsHandler');
              } catch (timingError) {
                Logger.logError('Error al solicitar timing', timingError, 'MapsHandler');
                // No es crítico porque los botones ya se mostraron
              }
            }
            
            await bot.sendMessage(chatId, '✅ URL y coordenadas agregadas al servicio. Los botones de acción ya están disponibles.');
            return;
          }
        } else {
          // No hay servicio pendiente, enviar las coordenadas directamente
          Logger.info(`No se encontró servicio pendiente para chat ${chatId}, enviando coordenadas directamente`, 'MapsHandler');
          
          // Fallback a método legacy
          await this._sendCoordinatesDirectly(bot, chatId, coordinates, text);
        }
      } catch (error) {
        Logger.logError('Error al procesar coordenadas con caché', error, 'MapsHandler');
        // Fallback a método legacy
        await this._sendCoordinatesDirectly(bot, chatId, coordinates, text);
      }
    } else {
      // Fallback a método legacy
      await this._sendCoordinatesDirectly(bot, chatId, coordinates, text);
    }
  }
  
  /**
   * Envía las coordenadas directamente (método legacy)
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {string} chatId - ID del chat
   * @param {string[]} coordinates - Coordenadas encontradas
   * @param {string} originalUrl - URL original
   */
  async _sendCoordinatesDirectly(bot, chatId, coordinates, originalUrl) {
    const { recLocation, config } = this.services;
    
    // Informar de las coordenadas encontradas
    await bot.sendMessage(chatId, `✅ Coordenadas extraídas:`)
      .catch(error => Logger.logError('Error al enviar mensaje', error, 'MapsHandler'));
    
    // Enviar cada coordenada
    for (const coordinate of coordinates) {
      await bot.sendMessage(chatId, coordinate)
        .catch(error => Logger.logError('Error al enviar coordenada', error, 'MapsHandler'));
    }
    
    // Solicitar tiempos de llegada si está configurado
    if (coordinates.length > 0 && recLocation) {
      try {
        await bot.sendMessage(chatId, '⏳ Solicitando tiempos de llegada...')
          .catch(error => Logger.logError('Error al enviar mensaje', error, 'MapsHandler'));
        
        await recLocation.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
        
        await bot.sendMessage(chatId, '✅ Tiempos de llegada solicitados. Los resultados se enviarán pronto.')
          .catch(error => Logger.logError('Error al enviar mensaje', error, 'MapsHandler'));
      } catch (error) {
        Logger.logError('Error al solicitar tiempos de llegada', error, 'MapsHandler');
        
        await bot.sendMessage(chatId, `❌ Error al solicitar tiempos de llegada: ${error.message}`)
          .catch(err => Logger.logError('Error al enviar mensaje de error', err, 'MapsHandler'));
      }
    }
  }

  // Método auxiliar para encontrar servicios pendientes
  _findPendingServiceForChat(chatId) {
    const { serviceCache } = this.services;
    
    // Buscar en los servicios almacenados (más recientes primero)
    const services = Array.from(serviceCache.serviceCache.entries())
      .filter(([id, data]) => 
        data.origin === chatId && 
        Date.now() - data.timestamp < 30 * 60 * 1000)  // Menos de 30 minutos
      .sort((a, b) => b[1].timestamp - a[1].timestamp);  // Ordenar por tiempo, más reciente primero
    
    // Imprimir información para debugging
    for (const [id, data] of services) {
      Logger.info(`Servicio candidato encontrado: ${id}, timestamp: ${new Date(data.timestamp).toISOString()}`, 'MapsHandler');
    }
    
    // Devolver el primero que encontremos
    return services.length > 0 ? services[0][0] : null;
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