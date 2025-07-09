/**
 * Comandos relacionados con la cola
 */
const BaseCommand = require('./base.command');

class QueueStatusCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/colaestado/;
  }

  /**
   * Ejecuta el comando /colaestado
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async execute(bot, msg) {
    const chatId = msg.chat.id;
    const { queue, config } = this.services;

    // Obtener el estado de la cola
    const queueLength = queue.getQueueLength(chatId);
    const isProcessing = queue.isProcessing(chatId);

    // Construir mensaje de estado
    let response = '📊 *Estado de la cola de mensajes:*\n\n';
    response += `• *Chat ID:* \`${chatId}\`\n`;
    response += `• *Estado:* ${isProcessing ? '🔄 Procesando' : '✅ Libre'}\n`;
    response += `• *Mensajes en cola:* ${queueLength}\n`;

    // Verificar también la cola del grupo
    if (config.TELEGRAM_GROUP_ID) {
      const groupQueueLength = queue.getQueueLength(config.TELEGRAM_GROUP_ID);
      const groupIsProcessing = queue.isProcessing(config.TELEGRAM_GROUP_ID);

      response += '\n📊 *Estado de la cola del grupo:*\n\n';
      response += `• *Grupo ID:* \`${config.TELEGRAM_GROUP_ID}\`\n`;
      response += `• *Estado:* ${groupIsProcessing ? '🔄 Procesando' : '✅ Libre'}\n`;
      response += `• *Mensajes en cola:* ${groupQueueLength}\n`;
    }

    // Enviar mensaje con información
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    this.logger.info(`Estado de cola enviado a ${chatId}`, 'QueueStatusCommand');
  }
}

class QueueClearCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/colalimpiar/;
  }

  /**
   * Ejecuta el comando /colalimpiar
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   */
  async execute(bot, msg) {
    const chatId = msg.chat.id;
    const { queue } = this.services;

    // Limpiar la cola del chat actual
    queue.clearQueue(chatId);

    // Enviar confirmación
    await bot.sendMessage(chatId, '🧹 Cola de mensajes limpiada correctamente.', { parse_mode: 'Markdown' });
    this.logger.info(`Cola limpiada para ${chatId}`, 'QueueClearCommand');
  }
}

module.exports = {
  QueueStatusCommand,
  QueueClearCommand
};
