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
    
    // Log del texto del mensaje para diagnóstico
    Logger.info(`Evaluando mensaje para timing: ${msg.text.substring(0, 50)}...`, 'TimingDetector');
    
    // Criterios más específicos basados en la captura de pantalla
    const isTimingReport = (
      msg.text.includes('Reporte General de Timing') ||
      (msg.text.includes('ASÍS VIAL') && msg.text.includes('ETA:')) ||
      (msg.text.includes('SEGUIMIENTO') && msg.text.includes('ETA:')) ||
      (msg.text.includes('HERE MATRIX') && msg.text.includes('ETA:')) ||
      (msg.text.includes('Dist:') && msg.text.includes('ETA:') && msg.text.includes('min'))
    );
    
    if (isTimingReport) {
      Logger.info(`✅ MENSAJE DE TIMING DETECTADO: ${msg.text.substring(0, 50)}...`, 'TimingDetector');
    }
    
    return isTimingReport;
  }
  
  /**
   * Procesa un reporte de timing
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async handle(bot, msg) {
    const chatId = msg.chat.id;
    const serviceCache = this.services.serviceCache;
    
    Logger.info(`Procesando reporte de timing en chat ${chatId}`, 'TimingDetector');
    
    if (!serviceCache) {
      Logger.error('ServiceCache no disponible para procesar timing', 'TimingDetector');
      return;
    }
    
    Logger.info('Detectado reporte de timing, buscando servicios pendientes...', 'TimingDetector');
    
    // Imprimir estadísticas para debugging
    let pendingServices = 0;
    let waitingForTiming = 0;
    
    for (const [serviceId, data] of serviceCache.serviceCache.entries()) {
      pendingServices++;
      if (data.waitingForTiming) waitingForTiming++;
      
      // Log detallado de cada servicio en caché
      Logger.info(`Servicio en caché: ${serviceId}, waitingForTiming: ${data.waitingForTiming}, hasTimings: ${data.hasTimings}, timestamp: ${new Date(data.timestamp).toISOString()}`, 'TimingDetector');
    }
    
    Logger.info(`Estadísticas: ${pendingServices} servicios en caché, ${waitingForTiming} esperando timing`, 'TimingDetector');
    
    // Convertir Map a Array para ordenar por timestamp (más reciente primero)
    const services = Array.from(serviceCache.serviceCache.entries())
      .filter(([id, data]) => data.waitingForTiming === true)
      .sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    let servicesFound = false;
    
    // Intentar primero con servicios que estén explícitamente esperando timing
    for (const [serviceId, data] of services) {
      Logger.info(`Encontrado servicio ${serviceId} esperando tiempos (estado explícito)`, 'TimingDetector');
      
      // Marcar que ya tenemos tiempos
      data.hasTimings = true;
      data.waitingForTiming = false;
      serviceCache.storeService(serviceId, data);
      
      // Actualizar el mensaje con los botones ahora que tenemos toda la info
      await this._updateMessageWithButtons(bot, data);
      
      servicesFound = true;
      break; // Solo actualizar el primer servicio que coincida
    }
    
    // Si no encontramos servicios esperando timing explícitamente, buscar cualquier servicio reciente
    if (!servicesFound) {
      Logger.warn('No se encontraron servicios esperando tiempos explícitamente. Buscando servicios recientes...', 'TimingDetector');
      
      // Buscar cualquier servicio reciente (últimos 10 minutos) sin tiempos como fallback
      const recentServices = Array.from(serviceCache.serviceCache.entries())
        .filter(([id, data]) => 
          Date.now() - data.timestamp < 10 * 60 * 1000 && // Menos de 10 minutos 
          data.hasUrl && 
          !data.hasTimings)
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      if (recentServices.length > 0) {
        const [serviceId, data] = recentServices[0];
        Logger.info(`Encontrado servicio reciente ${serviceId} como fallback. Timestamp: ${new Date(data.timestamp).toISOString()}`, 'TimingDetector');
        
        // Marcar que ya tenemos tiempos
        data.hasTimings = true;
        data.waitingForTiming = false;
        serviceCache.storeService(serviceId, data);
        
        // Actualizar el mensaje con los botones
        await this._updateMessageWithButtons(bot, data);
        servicesFound = true;
      }
    }
    
    if (!servicesFound) {
      Logger.warn('No se encontraron servicios para asociar con este reporte de timing.', 'TimingDetector');
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
    
    if (!serviceData.messageId) {
      Logger.warn(`No se pudo actualizar el mensaje: messageId no disponible para servicio ${serviceData.id}`, 'TimingDetector');
      return;
    }
    
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
      
      Logger.info(`Actualizando mensaje ${serviceData.messageId} con botones para servicio ${serviceData.id}`, 'TimingDetector');
      
      // Botones de acción - IMPORTANTE: No convertir a JSON string
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
        reply_markup: inlineKeyboard  // CLAVE: Enviar objeto directamente
      });
      
      Logger.info(`✅ Mensaje actualizado con botones para servicio ${serviceData.id}`, 'TimingDetector');
    } catch (error) {
      Logger.logError('Error al actualizar mensaje con botones', error, 'TimingDetector');
      
      // Intentar diagnóstico del error
      try {
        if (error.response && error.response.description) {
          Logger.error(`Detalle del error de Telegram: ${error.response.description}`, 'TimingDetector');
        }
        
        // Verificar mensajes alternativos para ver si tenemos permisos
        try {
          Logger.info(`Intentando enviar mensaje alternativo a ${config.TELEGRAM_GROUP_ID}`, 'TimingDetector');
          await bot.sendMessage(
            config.TELEGRAM_GROUP_ID,
            `⚠️ No se pudo actualizar el mensaje del servicio. Utilice los siguientes comandos:\n/tomar_${serviceData.id}\n/rechazar_${serviceData.id}`,
            { parse_mode: 'Markdown' }
          );
          Logger.info(`Mensaje alternativo enviado como fallback`, 'TimingDetector');
        } catch (altError) {
          Logger.error(`También falló el intento alternativo: ${altError.message}`, 'TimingDetector');
        }
      } catch (diagError) {
        Logger.error(`Error en diagnóstico: ${diagError.message}`, 'TimingDetector');
      }
    }
  }
}

module.exports = TimingDetectorHandler;