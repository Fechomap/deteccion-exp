// Punto de entrada principal de la aplicación
require('dotenv').config();
const Logger = require('./src/utils/logger');

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  Logger.logError('Excepción no capturada', error, 'Main');
  // En producción, podríamos querer reiniciar en lugar de terminar
  if (process.env.NODE_ENV === 'production') {
    Logger.error('Excepción no capturada en producción, reiniciando...', 'Main');
    process.exit(1);  // PM2 u otro gestor de procesos reiniciará la aplicación
  }
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error(`Promesa rechazada no manejada en: ${promise}, razón: ${reason}`, 'Main');
});

// Iniciar la aplicación
Logger.info('Iniciando Telegram Service Bot...', 'Main');
require('./src/index');

console.log('Bot de Telegram iniciado. Presiona Ctrl+C para detener.');
