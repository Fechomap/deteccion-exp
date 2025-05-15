/**
 * Comando /testtiming
 */
const BaseCommand = require('./base.command');

class TimingCommand extends BaseCommand {
  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    return /\/testtiming (.+)/;
  }
  
  /**
   * Ejecuta el comando /testtiming
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   * @param {Array} match - Resultado del match de regex
   */
  async execute(bot, msg, match) {
    const chatId = msg.chat.id;
    const coordinates = match[1].trim();
    const { recLocation, config } = this.services;
    
    this.logger.info(`Comando /testtiming recibido con coordenadas: ${coordinates}`, 'TimingCommand');
    
    try {
      // Notificar que estamos probando
      await bot.sendMessage(chatId, `Probando integración con RecLocation API...\nCoordenadas: ${coordinates}`, { parse_mode: 'Markdown' });
      
      // Solicitar timing report
      const result = await recLocation.requestTimingReport(coordinates, config.TELEGRAM_GROUP_ID);
      
      // Enviar resultado
      await bot.sendMessage(chatId, `✅ Solicitud enviada con éxito a RecLocation.\nRespuesta: ${JSON.stringify(result)}`, { parse_mode: 'Markdown' });
      this.logger.info(`Prueba de timing completada para ${coordinates}`, 'TimingCommand');
    } catch (error) {
      this.logger.logError('Error al probar timing', error, 'TimingCommand');
      await bot.sendMessage(chatId, `❌ Error al probar integración: ${error.message}`, { parse_mode: 'Markdown' });
    }
  }
}

module.exports = TimingCommand;