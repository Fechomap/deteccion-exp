/**
 * Punto de entrada principal de la aplicación
 */
const config = require('./config');
const Logger = require('./utils/logger');
const TelegramService = require('./services/telegram.service');
const RecLocationService = require('./services/reclocation.service');

/**
 * Función principal que inicia la aplicación
 */
async function main() {
  Logger.info('Iniciando aplicación...', 'Main');
  
  // Validar configuración
  if (!config.isValid) {
    Logger.error('Configuración inválida. Abortando.', 'Main');
    process.exit(1);
  }
  
  try {
    // Verificar conectividad con RecLocation API
    setTimeout(async () => {
      try {
        await RecLocationService.checkConnectivity();
      } catch (error) {
        Logger.warn(`No se pudo verificar la conectividad con RecLocation API: ${error.message}`, 'Main');
      }
    }, 1000);
    
    // Inicializar el bot de Telegram
    const bot = TelegramService.initialize();
    
    // Log de información de configuración
    Logger.info(`Configuración de IDs de chat - Detección-Exp: ${config.TELEGRAM_GROUP_ID}, RecLocation: ${config.RECLOCATION_GROUP_ID}`, 'Main');
    Logger.info('Bot de Telegram iniciado. Presiona Ctrl+C para detener.', 'Main');
  } catch (error) {
    Logger.logError('Error al iniciar la aplicación', error, 'Main');
    process.exit(1);
  }
}

// Manejar excepciones no capturadas
process.on('uncaughtException', (error) => {
  Logger.logError('Excepción no capturada', error, 'Main');
  // En producción, podríamos querer reiniciar en lugar de terminar
  if (config.NODE_ENV === 'production') {
    Logger.error('Excepción no capturada en producción, reiniciando...', 'Main');
    process.exit(1);  // PM2 u otro gestor de procesos reiniciará la aplicación
  }
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error(`Promesa rechazada no manejada en: ${promise}, razón: ${reason}`, 'Main');
});

// Iniciar la aplicación
main();