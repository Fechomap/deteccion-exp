/**
 * Manejador de comandos del bot
 */
const Logger = require('../utils/logger');
const ChatUtils = require('../utils/chat');
const RecLocationService = require('../services/reclocation.service');
const config = require('../config');

class CommandHandler {
  /**
   * Registra todos los manejadores de comandos
   * @param {TelegramBot} bot - Instancia del bot
   */
  static register(bot) {
    this._registerStartCommand(bot);
    this._registerHelpCommand(bot);
    this._registerChatIdCommand(bot);
    this._registerTestTimingCommand(bot);
    
    Logger.info('Manejadores de comandos registrados', 'CommandHandler');
  }
  
  /**
   * Registra el comando /start
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   */
  static _registerStartCommand(bot) {
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const info = ChatUtils.getChatInfo(msg);
      
      // Log detallado para comando start
      Logger.info(`Comando /start recibido:
        Chat ID: ${chatId}
        Tipo: ${info.chat.type}
        De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
        ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'CommandHandler');
      
      bot.sendMessage(chatId, 
        '¡Hola! Soy un bot que puede:\n\n' +
        '1. Extraer coordenadas de enlaces de Google Maps\n' +
        '2. Procesar texto copiado de la página web usando ChatGPT\n\n' +
        'Simplemente envíame un enlace de Google Maps o copia y pega el texto completo de la página.'
      ).then(() => Logger.info('Mensaje de bienvenida enviado', 'CommandHandler'))
       .catch(error => Logger.logError('Error al enviar mensaje', error, 'CommandHandler'));
    });
  }
  
  /**
   * Registra el comando /ayuda
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   */
  static _registerHelpCommand(bot) {
    bot.onText(/\/ayuda/, (msg) => {
      const chatId = msg.chat.id;
      const info = ChatUtils.getChatInfo(msg);
      
      // Log detallado para comando ayuda
      Logger.info(`Comando /ayuda recibido:
        Chat ID: ${chatId}
        Tipo: ${info.chat.type}
        De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
        ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'CommandHandler');
      
      bot.sendMessage(chatId, 
        '📍 *COORDENADAS*\n' +
        'Envíame cualquier enlace de Google Maps y extraeré las coordenadas.\n\n' +
        '📋 *TEXTO DE LA PÁGINA*\n' +
        'Haz lo siguiente:\n' +
        '1. Una vez que hayas atorado el servicio en la página web\n' +
        '2. Selecciona todo el texto (Ctrl+A o Cmd+A)\n' +
        '3. Copia el texto (Ctrl+C o Cmd+C)\n' +
        '4. Pega el texto en este chat (Ctrl+V o Cmd+V)\n\n' +
        'ChatGPT extraerá la siguiente información y te la enviaré en mensajes separados:\n' +
        '• Número de expediente\n' +
        '• Datos del vehículo\n' +
        '• Placas\n' +
        '• Usuario/Cliente\n' +
        '• Cuenta\n' +
        '• Entre calles (si está disponible)\n' +
        '• Referencia (si está disponible)',
        { parse_mode: 'Markdown' }
      ).then(() => Logger.info('Mensaje de ayuda enviado', 'CommandHandler'))
       .catch(error => Logger.logError('Error al enviar mensaje', error, 'CommandHandler'));
    });
  }
  
  /**
   * Registra el comando /chatid
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   */
  static _registerChatIdCommand(bot) {
    bot.onText(/\/chatid/, (msg) => {
      const chatId = msg.chat.id;
      const info = ChatUtils.getChatInfo(msg);
      const chatType = info.chat.type;
      
      // Construir respuesta con información detallada
      let response = `📢 *Información del chat:*\n\n`;
      response += `• *ID del chat:* \`${chatId}\`\n`;
      response += `• *Tipo de chat:* ${chatType}\n`;
      
      if (chatType === 'private') {
        response += `• *Usuario:* ${info.from.firstName} ${info.from.lastName}\n`;
        if (info.from.username) {
          response += `• *Username:* @${info.from.username}\n`;
        }
      } else {
        response += `• *Título del grupo:* ${info.chat.title}\n`;
        response += `• *Enviado por:* ${info.from.firstName} ${info.from.lastName}\n`;
        if (info.from.username) {
          response += `• *Username:* @${info.from.username}\n`;
        }
      }
      
      // Enviar mensaje con información
      bot.sendMessage(chatId, response, { parse_mode: 'Markdown' })
        .then(() => Logger.info(`Información del chat enviada a ${chatId}`, 'CommandHandler'))
        .catch(error => Logger.logError('Error al enviar información del chat', error, 'CommandHandler'));
      
      // Loggear la información completa
      Logger.info(`Comando /chatid ejecutado:
        Chat ID: ${chatId}
        Tipo: ${chatType}
        Título/Nombre: ${chatType === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
        ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'CommandHandler');
    });
  }
  
  /**
   * Registra el comando /testtiming
   * @private
   * @param {TelegramBot} bot - Instancia del bot
   */
  static _registerTestTimingCommand(bot) {
    bot.onText(/\/testtiming (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const coordinates = match[1].trim();
      
      Logger.info(`Comando /testtiming recibido con coordenadas: ${coordinates}`, 'CommandHandler');
      
      try {
        await bot.sendMessage(chatId, `Probando integración con RecLocation API...\nCoordenadas: ${coordinates}`, { parse_mode: 'Markdown' });
        // Utilizar TELEGRAM_GROUP_ID para asegurar que se envía al chat correcto
        const result = await RecLocationService.requestTimingReport(coordinates, config.TELEGRAM_GROUP_ID);
        await bot.sendMessage(chatId, `✅ Solicitud enviada con éxito a RecLocation.\nRespuesta: ${JSON.stringify(result)}`, { parse_mode: 'Markdown' });
      } catch (error) {
        await bot.sendMessage(chatId, `❌ Error al probar integración: ${error.message}`, { parse_mode: 'Markdown' });
      }
    });
  }
}

module.exports = CommandHandler;