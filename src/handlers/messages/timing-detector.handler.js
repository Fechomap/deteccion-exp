// src/handlers/messages/timing-detector.handler.js
/**
 * Manejador para detectar reportes de timing y actualizar el servicio con botones
 */
const BaseMessageHandler = require('./base.handler');
const Logger = require('../../utils/logger');

class TimingDetectorHandler extends BaseMessageHandler {
  /**
   * Verifica si el mensaje es un reporte de timing
   * @param {Object} msg - Mensaje de Telegram
   * @returns {boolean} - true si puede manejar el mensaje
   */
  canHandle(msg) {
    if (!msg.text) return false;
    
    // Detectar mensaje de timing por su contenido típico
    return msg.text.includes('Reporte General de Timing') && 
           (msg.text.includes('ASÍS VIAL') || msg.text.includes('SEGUIMIENTO') || 
            msg.text.includes('HERE MATRIX'));
  }
  
  /**
   * Procesa un reporte de timing
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async handle(bot, msg) {
    const chatId = msg.chat.id;
    const serviceCache = this.services.serviceCache;
    
    if (!serviceCache) return;
    
    Logger.info('Detectado reporte de timing, buscando servicios pendientes...', 'TimingDetector');
    
    // Buscar servicios que estén esperando tiempos
    for (const [serviceId, data] of serviceCache.serviceCache.entries()) {
      if (data.waitingForTiming && !data.hasTimings) {
        // Marcar que ya tenemos tiempos
        data.hasTimings = true;
        data.waitingForTiming = false;
        serviceCache.storeService(serviceId, data);
        
        // Actualizar el mensaje con los botones ahora que tenemos toda la info
        await this._updateMessageWithButtons(bot, data);
        break; // Solo actualizar el primer servicio que coincida
      }
    }
  }
  
  /**
   * Actualiza el mensaje con botones después de recibir tiempos
   * @private
   * @param {Object} bot - Instancia del bot
   * @param {Object} serviceData - Datos del servicio
   */
  async _updateMessageWithButtons(bot, serviceData) {
    const { config } = this.services;
    
    if (!serviceData.messageId) return;
    
    try {
      // Obtener información del vehículo
      const vehicleInfo = serviceData.messages && serviceData.messages.length > 1 ? 
                          serviceData.messages[1] : "No hay información del vehículo";
      
      // Construir mensaje completo con botones
      const finalMessage = `🚨 *Nuevo Servicio Disponible*\n\n` +
                          `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
                          (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
                          `⚡ *Tiempos recibidos ✓*\n\n` +
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
      
      // Actualizar el mensaje con los botones
      await bot.editMessageText(finalMessage, {
        chat_id: config.TELEGRAM_GROUP_ID,
        message_id: serviceData.messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: JSON.stringify(inlineKeyboard)
      });
      
      Logger.info(`Mensaje actualizado con botones para servicio ${serviceData.id}`, 'TimingDetector');
    } catch (error) {
      Logger.logError('Error al actualizar mensaje con botones', error, 'TimingDetector');
    }
  }
}

module.exports = TimingDetectorHandler;