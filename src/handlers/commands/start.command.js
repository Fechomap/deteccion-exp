/**
 * Comando /start
 */
const BaseCommand = require('./base.command');
const ChatUtils = require('../../utils/chat');

class StartCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/start/;
  }

  /**
   * Ejecuta el comando /start
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async execute(bot, msg) {
    const chatId = msg.chat.id;
    const info = ChatUtils.getChatInfo(msg);

    // Log detallado
    this.logger.info(`Comando /start recibido:
      Chat ID: ${chatId}
      Tipo: ${info.chat.type}
      De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
      ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'StartCommand');

    // Enviar mensaje de bienvenida
    await bot.sendMessage(chatId,
      '¡Hola! Soy un bot que puede:\n\n' +
      '1. Extraer coordenadas de enlaces de Google Maps\n' +
      '2. Procesar texto copiado de la página web usando ChatGPT\n\n' +
      'Simplemente envíame un enlace de Google Maps o copia y pega el texto completo de la página.'
    );

    this.logger.info('Mensaje de bienvenida enviado', 'StartCommand');
  }
}

module.exports = StartCommand;
