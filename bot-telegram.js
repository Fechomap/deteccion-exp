// Bot de Telegram con parser de texto
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { extractCoordinates } = require('./coordinatesExtractor');
const { parseServiceText, formatDataToMessages } = require('./textParser');
const fs = require('fs');
const path = require('path');

// Configurar directorio de logs
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Función para logs
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
  
  // Escribir en consola
  console.log(logMessage);
  
  // Escribir en archivo
  const logFile = path.join(logsDir, `bot_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

// Función para loggear errores
function logError(message, error) {
  log(`${message}: ${error.message}`, 'error');
  if (error.stack) {
    log(`Stack: ${error.stack}`, 'error');
  }
}

// Validación de variables de entorno
if (!process.env.TELEGRAM_TOKEN) {
  log("ERROR: No se encontró TELEGRAM_TOKEN en el archivo .env", 'error');
  process.exit(1);
}

// Configuración
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

// Crear una instancia del bot con polling
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Manejador de errores básico
bot.on('polling_error', (error) => {
  logError("Error de polling", error);
});

// Manejador para el comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  log(`Comando /start recibido del chat ID: ${chatId}`);
  
  bot.sendMessage(chatId, 
    '¡Hola! Soy un bot que puede:\n\n' +
    '1. Extraer coordenadas de enlaces de Google Maps\n' +
    '2. Procesar texto copiado de la página web\n\n' +
    'Simplemente envíame un enlace de Google Maps o copia y pega el texto de la página.'
  ).then(() => log('Mensaje de bienvenida enviado'))
   .catch(error => logError('Error al enviar mensaje', error));
});

// Manejador para el comando /ayuda
bot.onText(/\/ayuda/, (msg) => {
  const chatId = msg.chat.id;
  log(`Comando /ayuda recibido del chat ID: ${chatId}`);
  
  bot.sendMessage(chatId, 
    '📍 *COORDENADAS*\n' +
    'Envíame cualquier enlace de Google Maps y extraeré las coordenadas.\n\n' +
    '📋 *TEXTO DE LA PÁGINA*\n' +
    'Haz lo siguiente:\n' +
    '1. Una vez que hayas atorado el servicio en la página web\n' +
    '2. Selecciona todo el texto (Ctrl+A o Cmd+A)\n' +
    '3. Copia el texto (Ctrl+C o Cmd+C)\n' +
    '4. Pega el texto en este chat (Ctrl+V o Cmd+V)\n\n' +
    'Extraeré toda la información importante y te la enviaré en mensajes separados.',
    { parse_mode: 'Markdown' }
  ).then(() => log('Mensaje de ayuda enviado'))
   .catch(error => logError('Error al enviar mensaje', error));
});

// Manejador para mensajes de texto
bot.on('message', async (msg) => {
  // Verificar que sea un mensaje de texto y no un comando
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  log(`Mensaje recibido de ${chatId}: ${text.length} caracteres`);
  
  // Verificar si el mensaje contiene una URL de Google Maps
  if (text.includes('google.com/maps') || text.includes('google.com.mx/maps') || text.includes('maps.app.goo.gl')) {
    log('Detectado enlace de Google Maps, extrayendo coordenadas...');
    
    // Extraer coordenadas
    const coordinates = extractCoordinates(text);
    
    if (coordinates && coordinates.length > 0) {
      log(`Coordenadas encontradas: ${coordinates.join(', ')}`);
      
      // Enviar cada coordenada en un mensaje separado
      for (const coord of coordinates) {
        try {
          await bot.sendMessage(chatId, coord);
          log(`Coordenada enviada: ${coord}`);
        } catch (error) {
          logError(`Error al enviar coordenada: ${coord}`, error);
        }
      }
    } else {
      log('No se encontraron coordenadas en el enlace');
      bot.sendMessage(chatId, 'No pude encontrar coordenadas en el enlace proporcionado.')
        .catch(error => logError('Error al enviar mensaje', error));
    }
    return;
  }
  
  // Verificar si es un texto largo (posiblemente copiado de la página)
  if (text.length > 200 && (text.includes('GRUAS') || text.includes('Servicio') || text.includes('Vehículo'))) {
    log('Detectado texto de la página web, procesando...');
    
    // Notificar que estamos procesando el texto
    const processingMsg = await bot.sendMessage(chatId, 'Procesando texto... esto puede tomar unos segundos ⏳')
      .catch(error => {
        logError('Error al enviar mensaje de procesamiento', error);
        return null;
      });
    
    if (!processingMsg) return;
    
    try {
      // Procesar el texto
      const extractedData = parseServiceText(text);
      log(`Datos extraídos: ${JSON.stringify(extractedData)}`);
      
      // Formatear los datos para enviar
      const messages = formatDataToMessages(extractedData);
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => logError('Error al eliminar mensaje de procesamiento', error));
      
      // Enviar cada dato en un mensaje separado
      if (messages.length > 0) {
        for (const message of messages) {
          await bot.sendMessage(chatId, message)
            .then(() => log(`Dato enviado: ${message}`))
            .catch(error => logError('Error al enviar dato', error));
        }
      } else {
        await bot.sendMessage(chatId, "No se pudo extraer información del texto.")
          .catch(error => logError('Error al enviar mensaje', error));
      }
    } catch (error) {
      logError('Error al procesar el texto', error);
      
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => logError('Error al eliminar mensaje de procesamiento', err));
      
      await bot.sendMessage(chatId, `Ocurrió un error al procesar el texto: ${error.message}`)
        .catch(err => logError('Error al enviar mensaje de error', err));
    }
  }
});

log('Bot iniciado correctamente. Envía /start en Telegram para comenzar.');