/**
 * Configuración de variables de entorno y parámetros del sistema
 */
require('dotenv').config();

// Configuración general
const config = {
  // Telegram
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  TELEGRAM_GROUP_ID: process.env.TELEGRAM_GROUP_ID,
  ALLOWED_CHAT_IDS: process.env.ALLOWED_CHAT_IDS ? process.env.ALLOWED_CHAT_IDS.split(',').map(id => id.trim()) : [],

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // RecLocation
  RECLOCATION_API_URL: process.env.RECLOCATION_API_URL,
  RECLOCATION_API_TOKEN: process.env.RECLOCATION_API_TOKEN,
  RECLOCATION_GROUP_ID: process.env.RECLOCATION_GROUP_ID,

  // Aplicación
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  APP_URL: process.env.APP_URL,
  USE_WEBHOOK: process.env.USE_WEBHOOK === 'true'
};

// Validación de configuración crítica
const validateConfig = () => {
  const requiredEnvVars = [
    'TELEGRAM_TOKEN',
    'OPENAI_API_KEY',
    'RECLOCATION_API_TOKEN',
    'RECLOCATION_API_URL',
    'RECLOCATION_GROUP_ID',
    'TELEGRAM_GROUP_ID',
    'ALLOWED_CHAT_IDS'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`ERROR: Las siguientes variables de entorno son requeridas: ${missingVars.join(', ')}`);
    console.error('Por favor, configura estas variables en tu archivo .env');
    return false;
  }

  // Verificación de TELEGRAM_GROUP_ID para notificaciones al grupo
  if (!process.env.TELEGRAM_GROUP_ID) {
    console.warn('ADVERTENCIA: No se encontró TELEGRAM_GROUP_ID en el archivo .env. No se enviarán mensajes al grupo.');
  }

  return true;
};

// Exponer funciones de validación
config.isValid = validateConfig();
config.validate = validateConfig;

module.exports = config;
