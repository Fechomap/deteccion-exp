/**
 * Comando /ayuda
 */
const BaseCommand = require('./base.command');
const ChatUtils = require('../../utils/chat');

class HelpCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/ayuda/;
  }
  
  /**
   * Ejecuta el comando /ayuda
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async execute(bot, msg) {
    const chatId = msg.chat.id;
    const info = ChatUtils.getChatInfo(msg);
    
    // Log detallado
    this.logger.info(`Comando /ayuda recibido:
      Chat ID: ${chatId}
      Tipo: ${info.chat.type}
      De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
      ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'HelpCommand');
    
    // Enviar mensaje de ayuda
    await bot.sendMessage(chatId, 
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
      '• Referencia (si está disponible)\n\n' +
      '⚠️ *IMPORTANTE*\n' +
      'Si estás procesando texto con ChatGPT, cualquier enlace o mensaje adicional se pondrá en cola y se enviará después de que se complete el procesamiento actual.',
      { parse_mode: 'Markdown' }
    );
    
    this.logger.info('Mensaje de ayuda enviado', 'HelpCommand');
  }
}

module.exports = HelpCommand;