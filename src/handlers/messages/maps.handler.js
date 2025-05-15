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
    
    Logger.info(`Coordenadas encontradas: ${coordinates.join(', ')}`, 'MapsHandler');
    
    // Generar ID único para este grupo de mensajes
    const coordGroupId = `coords_${Date.now()}_${chatId}`;
    
    if (config.TELEGRAM_GROUP_ID) {
      try {
        // Encolar envío de URL original
        queue.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, text);
            Logger.info('URL enviada al grupo', 'MapsHandler');
          },
          'Envío de URL original',
          { groupId: coordGroupId }
        );
        
        // Encolar envío de coordenadas
        for (const coord of coordinates) {
          queue.enqueue(
            config.TELEGRAM_GROUP_ID,
            async () => {
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, coord);
              Logger.info(`Coordenada enviada al grupo: ${coord}`, 'MapsHandler');
            },
            `Envío de coordenada: ${coord}`,
            { groupId: coordGroupId }
          );
        }
        
        // Encolar solicitud de timing si hay coordenadas
        if (coordinates.length > 0) {
          queue.enqueue(
            config.TELEGRAM_GROUP_ID,
            async () => {
              // Mensaje de cálculo de tiempos
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⏱️ *Calculando tiempos de llegada...*', { parse_mode: 'Markdown' });
              
              // Solicitar timing a RecLocation
              Logger.info(`Solicitando timing para: ${coordinates[0]}`, 'MapsHandler');
              await recLocation.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
            },
            'Solicitud de timing para coordenadas',
            { groupId: coordGroupId }
          );
        }
        
        // Completar el grupo
        queue.completeGroup(coordGroupId, config.TELEGRAM_GROUP_ID, false);
        
        // Enviar confirmación al usuario
        await bot.sendMessage(chatId, '✅ URL y coordenadas enviadas correctamente al grupo de control.');
        Logger.info('Procesamiento de coordenadas completado', 'MapsHandler');
      } catch (error) {
        Logger.logError('Error al procesar URL de Google Maps', error, 'MapsHandler');
        await bot.sendMessage(chatId, `❌ Error al procesar las coordenadas: ${error.message}`);
      }
    } else {
      // Si no hay grupo configurado, solo enviar al usuario
      await bot.sendMessage(chatId, `📍 Coordenadas encontradas: ${coordinates.join('\n')}`);
    }
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