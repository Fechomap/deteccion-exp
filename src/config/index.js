/**
 * Configuración de variables de entorno y parámetros del sistema
 */
require('dotenv').config();

// Configuración general
const config = {
  // Telegram
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  TELEGRAM_GROUP_ID: process.env.TELEGRAM_GROUP_ID,
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // RecLocation
  RECLOCATION_API_URL: process.env.RECLOCATION_API_URL || 'https://web-production-23d41.up.railway.app/api/timing',
  RECLOCATION_API_TOKEN: process.env.RECLOCATION_API_TOKEN || 'token_1000_anios_jehova',
  RECLOCATION_GROUP_ID: process.env.RECLOCATION_GROUP_ID || '-1002420951714',
  
  // Aplicación
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  APP_URL: process.env.APP_URL,
  USE_WEBHOOK: process.env.USE_WEBHOOK === 'true',
};

// Validación de configuración crítica
const validateConfig = () => {
  const requiredEnvVars = [
    'TELEGRAM_TOKEN',
    'OPENAI_API_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`ERROR: Las siguientes variables de entorno son requeridas: ${missingVars.join(', ')}`);
    console.error('Por favor, configura estas variables en tu archivo .env');
    return false;
  }
  
  // Verificación de TELEGRAM_GROUP_ID para notificaciones al grupo
  if (!process.env.TELEGRAM_GROUP_ID) {
    console.warn("ADVERTENCIA: No se encontró TELEGRAM_GROUP_ID en el archivo .env. No se enviarán mensajes al grupo.");
  }
  
  return true;
};

// Exponer funciones de validación
config.isValid = validateConfig();
config.validate = validateConfig;

module.exports = config;