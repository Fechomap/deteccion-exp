/**
 * Punto de entrada para manejadores de mensajes
 */
const Logger = require('../../utils/logger');
const MapsMessageHandler = require('./maps.handler');
const ServiceMessageHandler = require('./service.handler');
const TimingDetectorHandler = require('./timing-detector.handler');

class MessageHandlerRegistry {
  constructor(services) {
    this.services = services;
    this.handlers = [
      new MapsMessageHandler(services),
      new ServiceMessageHandler(services),
      new TimingDetectorHandler(services)
    ];

    Logger.info(`Registrados ${this.handlers.length} manejadores de mensajes`, 'MessageRegistry');
  }

  /**
   * Registra los manejadores en el bot
   * @param {TelegramBot} bot - Instancia del bot de Telegram
   */
  register(bot) {
    bot.on('message', async (msg) => {
      // Ignorar comandos
      if (!msg.text || msg.text.startsWith('/')) return;

      // Buscar un manejador adecuado
      for (const handler of this.handlers) {
        if (handler.canHandle(msg)) {
          Logger.info(`Mensaje delegado a: ${handler.constructor.name}`, 'MessageRegistry');
          await handler.handle(bot, msg);
          return; // Evitar que múltiples manejadores procesen el mismo mensaje
        }
      }

      // Si llegamos aquí, ningún manejador pudo procesar el mensaje
      Logger.info(`Ningún manejador pudo procesar el mensaje: ${msg.text.substring(0, 30)}...`, 'MessageRegistry');
    });

    Logger.info('Manejador general de mensajes registrado', 'MessageRegistry');
  }
}

module.exports = MessageHandlerRegistry;
