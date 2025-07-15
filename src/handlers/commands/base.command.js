/**
 * Clase base para comandos de bot
 */
const Logger = require('../../utils/logger');
const AuthService = require('../../services/auth.service');

class BaseCommand {
  /**
   * Constructor para la clase base de comandos
   * @param {Object} services - Servicios inyectados
   */
  constructor(services) {
    if (this.constructor === BaseCommand) {
      throw new Error('BaseCommand es una clase abstracta y no puede ser instanciada directamente');
    }

    this.logger = Logger;
    this.services = services;
  }

  /**
   * Obtiene el patrón regex para el comando
   * @returns {RegExp} - Patrón de regex para el comando
   */
  getPattern() {
    throw new Error('El método getPattern debe ser implementado por las subclases');
  }

  /**
   * Ejecuta el comando
   * @param {Object} bot - Instancia del bot de Telegram
   * @param {Object} msg - Mensaje de Telegram
   * @param {Array} match - Resultado del match de regex
   * @returns {Promise} - Promesa que se resuelve cuando se completa la ejecución
   */
  async execute(bot, msg, match) {
    throw new Error('El método execute debe ser implementado por las subclases');
  }

  /**
   * Registra el comando en el bot
   * @param {Object} bot - Instancia del bot de Telegram
   */
  register(bot) {
    bot.onText(this.getPattern(), async (msg, match) => {
      try {
        // Validar autorización del usuario
        if (!AuthService.validateMessage(msg)) {
          this.logger.warn(`Acceso denegado para comando ${this.constructor.name} - chat ID: ${msg.chat.id}`, 'Command');
          return;
        }

        await this.execute(bot, msg, match);
      } catch (error) {
        this.logger.logError(`Error al ejecutar comando ${this.constructor.name}`, error, 'Command');
      }
    });

    this.logger.info(`Comando ${this.constructor.name} registrado con patrón: ${this.getPattern()}`, 'Command');
  }
}

module.exports = BaseCommand;
