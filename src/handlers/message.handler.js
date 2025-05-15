/**
 * Manejador de mensajes del bot
 */
const Logger = require('../utils/logger');
const ChatUtils = require('../utils/chat');
const RecLocationService = require('../services/reclocation.service');
const OpenAIService = require('../services/openai.service');
const CoordinatesUtil = require('../utils/coordinates');
const config = require('../config');

class MessageHandler {
  /**
   * Registra el manejador de mensajes
   * @param {TelegramBot} bot - Instancia del bot
   */
  static register(bot) {
    bot.on('message', async (msg) => {
      // Verificar que sea un mensaje de texto y no un comando
      if (!msg.text || msg.text.startsWith('/')) return;
      
      const chatId = msg.chat.id;
      const text = msg.text;
      
      // Obtener y loggear información detallada
      const info = ChatUtils.getChatInfo(msg);
      
      // Log detallado en formato amigable para consola
      Logger.info(`MENSAJE RECIBIDO - DETALLES:
          Chat ID: ${chatId}
          Tipo: ${info.chat.type}
          De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title} ${info.from.username ? `(@${info.from.username})` : ''}
          Longitud: ${text.length} caracteres
          Vista previa: ${text.substring(0, 30) + (text.length > 30 ? '...' : '')}`, 'MessageHandler');
      
      // Determinar tipo de mensaje y procesar
      if (this._isGoogleMapsUrl(text)) {
        await this._handleGoogleMapsUrl(bot, msg);
      } else if (this._isServiceText(text)) {
        await this._handleServiceText(bot, msg);
      }
    });
    
    Logger.info('Manejador de mensajes registrado', 'MessageHandler');
  }
  
  /**
   * Verifica si el texto contiene una URL de Google Maps
   * @private
   * @param {string} text - Texto del mensaje
   * @returns {boolean} - true si es URL de Google Maps
   */
  static _isGoogleMapsUrl(text) {
    return text.includes('google.com/maps') || 
           text.includes('google.com.mx/maps') || 
           text.includes('maps.app.goo.gl');
  }
  
  /**
   * Verifica si el texto parece ser un texto copiado del servicio
   * @private
   * @param {string} text - Texto del mensaje
   * @returns {boolean} - true si parece texto de servicio
   */
  static _isServiceText(text) {
    return text.length > 200 && 
          (text.includes('GRUAS') || 
           text.includes('Servicio') || 
           text.includes('Vehículo'));
  }
  
  /**
   * Maneja URLs de Google Maps
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   * @param {Object} msg - Mensaje de Telegram
   */
  static async _handleGoogleMapsUrl(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    Logger.info('Detectado enlace de Google Maps, extrayendo coordenadas...', 'MessageHandler');
    
    // Extraer coordenadas
    const coordinates = CoordinatesUtil.extractCoordinates(text);
    
    if (coordinates && coordinates.length > 0) {
      Logger.info(`Coordenadas encontradas: ${coordinates.join(', ')}`, 'MessageHandler');
      
      // Enviar la URL original al grupo y confirmación al origen
      if (config.TELEGRAM_GROUP_ID) {
        try {
          await bot.sendMessage(config.TELEGRAM_GROUP_ID, text);
          await bot.sendMessage(chatId, '✅ URL enviada correctamente al grupo de control.');
          Logger.info('URL enviada al grupo', 'MessageHandler');
        } catch (error) {
          Logger.logError('Error al enviar URL al grupo', error, 'MessageHandler');
        }
      }
      
      // Enviar cada coordenada al grupo y una confirmación al origen
      for (const coord of coordinates) {
        try {
          await ChatUtils.sendToGroupWithConfirmation(
            bot, 
            chatId, 
            coord, 
            config.TELEGRAM_GROUP_ID, 
            '✅ Coordenadas enviadas correctamente al grupo de control.'
          );
        } catch (error) {
          Logger.logError(`Error al enviar coordenada: ${coord}`, error, 'MessageHandler');
        }
      }
      
      // INTEGRACIÓN: Solicitar automáticamente el timing para la primera coordenada
      if (coordinates.length > 0) {
        try {
          // CAMBIO DE ORDEN: Primero enviar mensaje de "Calculando tiempos de llegada..."
          if (config.TELEGRAM_GROUP_ID) {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⏱️ *Calculando tiempos de llegada...*', { parse_mode: 'Markdown' });
            Logger.info('Mensaje de cálculo de tiempos enviado', 'MessageHandler');
          }
          
          // Luego hacer la solicitud a RecLocation
          Logger.info(`Solicitando automáticamente timing para coordenada: ${coordinates[0]}`, 'MessageHandler');
          await RecLocationService.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
          Logger.info(`Solicitud de timing completada exitosamente`, 'MessageHandler');
        } catch (error) {
          Logger.logError('Error al solicitar timing automático', error, 'MessageHandler');
        }
      }
    } else {
      Logger.info('No se encontraron coordenadas en el enlace', 'MessageHandler');
      bot.sendMessage(chatId, 'No pude encontrar coordenadas en el enlace proporcionado.')
        .catch(error => Logger.logError('Error al enviar mensaje', error, 'MessageHandler'));
    }
  }

  /**
   * Maneja texto de servicio
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   * @param {Object} msg - Mensaje de Telegram
   */
  static async _handleServiceText(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    Logger.info('Detectado texto de la página web, procesando con ChatGPT...', 'MessageHandler');
    
    // Notificar que estamos procesando el texto
    const processingMsg = await bot.sendMessage(chatId, 'Procesando texto con ChatGPT... esto puede tomar unos segundos ⏳')
      .catch(error => {
        Logger.logError('Error al enviar mensaje de procesamiento', error, 'MessageHandler');
        return null;
      });
    
    if (!processingMsg) return;
    
    try {
      // Procesar el texto usando ChatGPT
      const extractedData = await OpenAIService.parseServiceText(text);
      Logger.info(`Datos extraídos por ChatGPT: ${JSON.stringify(extractedData)}`, 'MessageHandler');
      
      // Formatear los datos para enviar
      const messages = OpenAIService.formatDataToMessages(extractedData);
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'MessageHandler'));
      
      // Enviar alertas antes de los datos
      if (config.TELEGRAM_GROUP_ID && messages.length > 0) {
        try {
          await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚨👀 Oigan...', { parse_mode: 'Markdown' });
          await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⚠️📍 Hay un posible servicio de *CHUBB*', { parse_mode: 'Markdown' });
          await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚗💨 ¿A alguien le queda?', { parse_mode: 'Markdown' });
          Logger.info('Alertas enviadas al grupo', 'MessageHandler');
        } catch (error) {
          Logger.logError('Error al enviar alertas al grupo', error, 'MessageHandler');
        }
      }
      
      // Enviar cada dato en un mensaje separado
      if (messages.length > 0) {
        // Enviar un solo mensaje de confirmación al chat de origen
        await bot.sendMessage(chatId, '✅ Los datos del vehículo han sido enviados correctamente al grupo de control.');
        
        // Enviar cada mensaje al grupo destino
        for (const message of messages) {
          try {
            // Solo enviar al grupo destino, no al chat de origen
            if (config.TELEGRAM_GROUP_ID) {
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, message);
              Logger.info(`Mensaje enviado al grupo: ${message}`, 'MessageHandler');
            }
          } catch (error) {
            Logger.logError(`Error al enviar dato: ${message}`, error, 'MessageHandler');
          }
        }
        
        Logger.info('Procesamiento de texto completado, datos enviados correctamente', 'MessageHandler');
      } else {
        await bot.sendMessage(chatId, "No se pudo extraer información del texto.")
          .catch(error => Logger.logError('Error al enviar mensaje', error, 'MessageHandler'));
      }
    } catch (error) {
      Logger.logError('Error al procesar el texto con ChatGPT', error, 'MessageHandler');
      
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => Logger.logError('Error al eliminar mensaje de procesamiento', err, 'MessageHandler'));
      
      await bot.sendMessage(chatId, `Ocurrió un error al procesar el texto con ChatGPT: ${error.message}`)
        .catch(err => Logger.logError('Error al enviar mensaje de error', err, 'MessageHandler'));
    }
  }
}

module.exports = MessageHandler;