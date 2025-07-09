/**
 * Registro centralizado de comandos
 */
const Logger = require('../../utils/logger');
const StartCommand = require('./start.command');
const HelpCommand = require('./help.command');
const ChatIdCommand = require('./chatid.command');
const TimingCommand = require('./timing.command');
const { QueueStatusCommand, QueueClearCommand } = require('./queue.commands');

class CommandRegistry {
  /**
   * Constructor del registro de comandos
   * @param {Object} services - Servicios inyectados
   */
  constructor(services) {
    this.services = services;
    this.commands = [
      new StartCommand(services),
      new HelpCommand(services),
      new ChatIdCommand(services),
      new TimingCommand(services),
      new QueueStatusCommand(services),
      new QueueClearCommand(services)
    ];

    Logger.info(`Inicializados ${this.commands.length} comandos`, 'CommandRegistry');
  }

  /**
   * Registra todos los comandos en el bot
   * @param {Object} bot - Instancia del bot de Telegram
   */
  register(bot) {
    this.commands.forEach(command => command.register(bot));
    Logger.info('Todos los comandos registrados en el bot', 'CommandRegistry');
  }
}

module.exports = CommandRegistry;
