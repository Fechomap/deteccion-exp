/**
 * Manejador de mensajes del bot
 */
const Logger = require('../utils/logger');
const ChatUtils = require('../utils/chat');
const RecLocationService = require('../services/reclocation.service');
const OpenAIService = require('../services/openai.service');
const CoordinatesUtil = require('../utils/coordinates');
const MessageQueueService = require('../services/message-queue.service');
const config = require('../config');

class MessageHandler {
  // Mapa para almacenar el estado de procesamiento de ChatGPT por chatId
  static processingChatGPT = new Map();
  
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
    
    // Obtener el estado actual de la cola
    const isProcessing = MessageQueueService.isProcessing(chatId);
    const queueLength = MessageQueueService.getQueueLength(chatId);
    
    if (isProcessing) {
      Logger.info(`⚠️ Chat ${chatId} está actualmente procesando mensajes. Mensajes en cola: ${queueLength}`, 'MessageHandler');
    }
    
    // Determinar tipo de mensaje y encolarlo para procesamiento
    if (this._isGoogleMapsUrl(text)) {
      // Verificar si hay procesamiento de ChatGPT en curso
      if (this.processingChatGPT.get(chatId)) {
        Logger.info(`⚠️ Se detectó URL de Google Maps mientras se procesa ChatGPT para chat ${chatId}. Se encolará con alta prioridad.`, 'MessageHandler');
        await bot.sendMessage(chatId, '⏳ Tu enlace de Google Maps se procesará después de que termine el análisis actual de ChatGPT...')
          .catch(error => Logger.logError('Error al enviar mensaje de espera', error, 'MessageHandler'));
      }
      
      // Encolar el procesamiento de la URL de Google Maps
      MessageQueueService.enqueue(
        chatId,
        async () => await this._handleGoogleMapsUrl(bot, msg),
        'Procesamiento de URL de Google Maps',
        { priority: !this.processingChatGPT.get(chatId) } // Prioridad alta si no hay procesamiento de ChatGPT
      );
    } else if (this._isServiceText(text)) {
      // Marcar este chat como en procesamiento de ChatGPT
      this.processingChatGPT.set(chatId, true);
      Logger.info(`⏳ Iniciando procesamiento de ChatGPT para chat ${chatId}. Se bloquearán otros mensajes.`, 'MessageHandler');
      
      // Encolar el procesamiento del texto de servicio con máxima prioridad
      MessageQueueService.enqueue(
        chatId,
        async () => {
          await this._handleServiceText(bot, msg);
          // Después de procesar, limpiar el estado
          this.processingChatGPT.set(chatId, false);
          Logger.info(`✅ Procesamiento de ChatGPT completado para chat ${chatId}. Se liberarán otros mensajes.`, 'MessageHandler');
        },
        'Procesamiento de texto de servicio con ChatGPT',
        { priority: true }  // Alta prioridad para el procesamiento de ChatGPT
      );
    }
  });
  
  Logger.info('Manejador de mensajes registrado con sistema de cola mejorado', 'MessageHandler');
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
  
  Logger.info('Procesando enlace de Google Maps, extrayendo coordenadas...', 'MessageHandler');
  
  // Informar que estamos procesando
  const processingMsg = await bot.sendMessage(chatId, '🔄 Procesando enlace de Google Maps...')
    .catch(error => {
      Logger.logError('Error al enviar mensaje de procesamiento', error, 'MessageHandler');
      return null;
    });
  
  // Extraer coordenadas
  const coordinates = CoordinatesUtil.extractCoordinates(text);
  
  if (coordinates && coordinates.length > 0) {
    Logger.info(`Coordenadas encontradas: ${coordinates.join(', ')}`, 'MessageHandler');
    
    // Eliminar el mensaje de procesamiento
    if (processingMsg) {
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'MessageHandler'));
    }
    
    // Generar ID único para este grupo de mensajes de coordenadas
    const coordGroupId = `coords_${Date.now()}_${chatId}`;
    
    // Enviar la URL original al grupo y confirmación al origen
    if (config.TELEGRAM_GROUP_ID) {
      try {
        // Encolar el envío de la URL original al grupo
        MessageQueueService.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, text);
            Logger.info('URL enviada al grupo', 'MessageHandler');
          },
          'Envío de URL original',
          { groupId: coordGroupId }
        );
        
        // Encolar el envío de las coordenadas al grupo
        for (const coord of coordinates) {
          MessageQueueService.enqueue(
            config.TELEGRAM_GROUP_ID,
            async () => {
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, coord);
              Logger.info(`Coordenada encolada al grupo: ${coord}`, 'MessageHandler');
            },
            `Envío de coordenada: ${coord}`,
            { groupId: coordGroupId }
          );
        }
        
        // Encolar la solicitud de timing para la primera coordenada
        if (coordinates.length > 0) {
          MessageQueueService.enqueue(
            config.TELEGRAM_GROUP_ID,
            async () => {
              // Enviar mensaje de cálculo de tiempos
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⏱️ *Calculando tiempos de llegada...*', { parse_mode: 'Markdown' });
              Logger.info('Mensaje de cálculo de tiempos enviado', 'MessageHandler');
              
              // Solicitar timing a RecLocation
              Logger.info(`Solicitando automáticamente timing para coordenada: ${coordinates[0]}`, 'MessageHandler');
              await RecLocationService.requestTimingReport(coordinates[0], config.TELEGRAM_GROUP_ID);
              Logger.info(`Solicitud de timing completada exitosamente`, 'MessageHandler');
            },
            'Solicitud de timing para coordenadas',
            { groupId: coordGroupId }
          );
        }
        
        // Completar el grupo para enviar todo junto
        MessageQueueService.completeGroup(coordGroupId, config.TELEGRAM_GROUP_ID, false);
        
        // Enviar confirmación al usuario
        await bot.sendMessage(chatId, '✅ URL y coordenadas enviadas correctamente al grupo de control.');
        Logger.info('Confirmación de coordenadas enviada al usuario', 'MessageHandler');
      } catch (error) {
        Logger.logError('Error al procesar URL de Google Maps', error, 'MessageHandler');
        await bot.sendMessage(chatId, `❌ Error al procesar las coordenadas: ${error.message}`)
          .catch(err => Logger.logError('Error al enviar mensaje de error', err, 'MessageHandler'));
      }
    }
  } else {
    // Eliminar el mensaje de procesamiento
    if (processingMsg) {
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'MessageHandler'));
    }
    
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
  
  Logger.info('Iniciando procesamiento de texto con ChatGPT...', 'MessageHandler');
  
  // Notificar que estamos procesando el texto
  const processingMsg = await bot.sendMessage(chatId, '🧠 Procesando texto con ChatGPT... esto puede tomar unos segundos ⏳')
    .catch(error => {
      Logger.logError('Error al enviar mensaje de procesamiento', error, 'MessageHandler');
      return null;
    });
  
  if (!processingMsg) return;
  
  try {
    // Bloquear temporalmente otros mensajes durante el procesamiento
    // al establecer el estado en el mapa (ya se hizo al encolar)
    
    // Procesar el texto usando ChatGPT
    const extractedData = await OpenAIService.parseServiceText(text);
    Logger.info(`Datos extraídos por ChatGPT: ${JSON.stringify(extractedData)}`, 'MessageHandler');
    
    // Formatear los datos para enviar
    const messages = OpenAIService.formatDataToMessages(extractedData);
    
    // Eliminar el mensaje de procesamiento
    await bot.deleteMessage(chatId, processingMsg.message_id)
      .catch(error => Logger.logError('Error al eliminar mensaje de procesamiento', error, 'MessageHandler'));
    
    // Generar ID único para este grupo de mensajes de servicio
    const serviceGroupId = `service_${Date.now()}_${chatId}`;
    
    // Enviar alertas antes de los datos, usando la cola para mantener el orden
    if (config.TELEGRAM_GROUP_ID && messages.length > 0) {
      try {
        // Encolar los mensajes de alerta como grupo
        MessageQueueService.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚨👀 Oigan...', { parse_mode: 'Markdown' });
          },
          'Alerta inicial',
          { groupId: serviceGroupId }
        );
        
        MessageQueueService.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, '⚠️📍 Hay un posible servicio de *CHUBB*', { parse_mode: 'Markdown' });
          },
          'Alerta CHUBB',
          { groupId: serviceGroupId }
        );
        
        MessageQueueService.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            await bot.sendMessage(config.TELEGRAM_GROUP_ID, '🚗💨 ¿A alguien le queda?', { parse_mode: 'Markdown' });
          },
          'Pregunta disponibilidad',
          { groupId: serviceGroupId }
        );
        
        Logger.info('Alertas encoladas en grupo', 'MessageHandler');
      } catch (error) {
        Logger.logError('Error al encolar alertas al grupo', error, 'MessageHandler');
      }
    }
    
    // Enviar cada dato en un mensaje separado, agrupado para garantizar envío atómico
    if (messages.length > 0) {
      // Enviar un solo mensaje de confirmación al chat de origen
      await bot.sendMessage(chatId, '✅ Los datos del vehículo han sido enviados correctamente al grupo de control.');
      
      // Encolar cada mensaje como parte del mismo grupo
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        MessageQueueService.enqueue(
          config.TELEGRAM_GROUP_ID,
          async () => {
            if (config.TELEGRAM_GROUP_ID) {
              await bot.sendMessage(config.TELEGRAM_GROUP_ID, message);
              Logger.info(`Mensaje encolado al grupo: ${message}`, 'MessageHandler');
            }
          },
          `Dato ${i+1}: ${message.substr(0, 30)}${message.length > 30 ? '...' : ''}`,
          { groupId: serviceGroupId }
        );
      }
      
      // Completar el grupo para que se procese en orden
      MessageQueueService.completeGroup(serviceGroupId, config.TELEGRAM_GROUP_ID, true);
      
      Logger.info('Procesamiento de texto completado, datos agrupados y enviados a la cola', 'MessageHandler');
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
  } finally {
    // Asegurar que se libere el estado de procesamiento (ya se hace en la cola)
  }
}
}

module.exports = MessageHandler;