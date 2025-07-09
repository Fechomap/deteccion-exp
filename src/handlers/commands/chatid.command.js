/**
 * Comando /chatid
 */
const BaseCommand = require('./base.command');
const ChatUtils = require('../../utils/chat');

class ChatIdCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/chatid/;
  }

  /**
   * Ejecuta el comando /chatid
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async execute(bot, msg) {
    const chatId = msg.chat.id;
    const info = ChatUtils.getChatInfo(msg);
    const chatType = info.chat.type;

    // Construir respuesta con información detallada
    let response = '📢 *Información del chat:*\n\n';
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
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });

    this.logger.info(`Información del chat enviada a ${chatId}`, 'ChatIdCommand');
  }
}

module.exports = ChatIdCommand;
