/**
 * Servicio principal del Bot de Telegram
 */
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const config = require('../config');
const Logger = require('../utils/logger');
// Importar los nuevos registros en lugar de los handlers antiguos
const CommandRegistry = require('../handlers/commands');
const MessageHandlerRegistry = require('../handlers/messages');

class TelegramService {
  /**
   * Inicializa el bot de Telegram con la configuración adecuada
   * @returns {TelegramBot} - Instancia del bot
   */
  static initialize() {
    // Inicializar el bot según la configuración
    let bot;

    // Verificar si estamos en modo desarrollo forzado
    const isLocalDev = config.NODE_ENV === 'development' || !config.USE_WEBHOOK;

    if (isLocalDev) {
      // Modo polling para desarrollo local
      Logger.info('Iniciando bot en modo polling para desarrollo local', 'Telegram');
      bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

      // Luego intentamos eliminar el webhook, pero no dependemos de ello para crear el bot
      const tempBot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });
      tempBot.deleteWebHook()
        .then(() => {
          Logger.info('Webhook eliminado con éxito para desarrollo local', 'Telegram');
        })
        .catch(error => {
          Logger.logError('Error al eliminar webhook', error, 'Telegram');
          Logger.info('Continuando en modo polling a pesar del error', 'Telegram');
        });
    } else if (config.USE_WEBHOOK && config.APP_URL) {
      // Modo webhook para producción
      Logger.info(`Iniciando bot en modo webhook en URL: ${config.APP_URL}`, 'Telegram');
      bot = new TelegramBot(config.TELEGRAM_TOKEN, { webHook: true });

      // Configurar webhook
      bot.setWebHook(`${config.APP_URL}/bot${config.TELEGRAM_TOKEN}`);

      // Crear servidor Express para webhook
      const app = express();

      // Configurar middleware para Telegram
      app.use(express.json());

      // Ruta para webhook de Telegram
      app.post(`/bot${config.TELEGRAM_TOKEN}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
      });

      // Ruta de verificación
      app.get('/', (req, res) => {
        res.send('El bot está funcionando correctamente');
      });

      // Iniciar servidor
      app.listen(config.PORT, () => {
        Logger.info(`Servidor Express iniciado en el puerto ${config.PORT}`, 'Telegram');
      });
    } else {
      // Fallback a modo polling si no hay configuración clara
      Logger.info('No se pudo determinar el modo. Fallback a polling', 'Telegram');
      bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
    }

    // No registramos los handlers aquí, los pasamos de vuelta
    // para que se registren en src/index.js

    // Manejador de errores de polling
    bot.on('polling_error', (error) => {
      Logger.logError('Error de polling', error, 'Telegram');
    });

    // Mensaje de inicio
    const mode = config.USE_WEBHOOK ? `webhook en ${config.APP_URL}` : 'polling';
    Logger.info(`Bot iniciado correctamente en modo ${mode}`, 'Telegram');

    return bot;
  }
}

module.exports = TelegramService;
