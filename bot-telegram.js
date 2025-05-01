// Bot de Telegram con parser de texto usando ChatGPT
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { extractCoordinates } = require('./coordinatesExtractor');
const { parseServiceText, formatDataToMessages } = require('./textParserGPT'); // Usamos la versión GPT
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

if (!process.env.OPENAI_API_KEY) {
  log("ERROR: No se encontró OPENAI_API_KEY en el archivo .env", 'error');
  process.exit(1);
}

// Verificación de TELEGRAM_GROUP_ID para notificaciones al grupo
if (!process.env.TELEGRAM_GROUP_ID) {
  log("ADVERTENCIA: No se encontró TELEGRAM_GROUP_ID en el archivo .env. No se enviarán mensajes al grupo.", 'warn');
}

// Configuración
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 3000;
const URL = process.env.APP_URL;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_ID ? parseInt(process.env.TELEGRAM_GROUP_ID) : null;

// Crear una instancia del bot
let bot;

if (USE_WEBHOOK && URL) {
  // Modo webhook para producción
  log(`Iniciando bot en modo webhook en URL: ${URL}`);
  bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
  
  // Configurar webhook
  bot.setWebHook(`${URL}/bot${TELEGRAM_TOKEN}`);
  
  // Crear servidor Express para webhook (si no existe)
  const express = require('express');
  const app = express();
  
  // Configurar middleware para Telegram
  app.use(express.json());
  
  // Ruta para webhook de Telegram
  app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
  
  // Ruta de verificación
  app.get('/', (req, res) => {
    res.send('El bot está funcionando correctamente');
  });
  
  // Iniciar servidor
  app.listen(PORT, () => {
    log(`Servidor Express iniciado en el puerto ${PORT}`);
  });
} else {
  // Modo polling para desarrollo local
  log('Iniciando bot en modo polling');
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
}

/**
 * Envía un mensaje al usuario original y también al grupo (si está configurado)
 * @param {number} userChatId - ID del chat del usuario
 * @param {string} message - Mensaje a enviar
 * @param {boolean} sendToGroup - Si debe enviarse al grupo
 * @returns {Promise} - Promesa que se resuelve cuando ambos mensajes han sido enviados
 */
async function sendMessageToUserAndGroup(userChatId, message, sendToGroup = true) {
  try {
    // Enviar al usuario
    await bot.sendMessage(userChatId, message);
    log(`Mensaje enviado a usuario ${userChatId}: ${message}`);
    
    // Enviar al grupo si está configurado
    if (sendToGroup && GROUP_CHAT_ID) {
      await bot.sendMessage(GROUP_CHAT_ID, message);
      log(`Mensaje enviado al grupo ${GROUP_CHAT_ID}: ${message}`);
    }
  } catch (error) {
    logError('Error al enviar mensaje', error);
    throw error; // Re-lanzar el error para manejarlo en la función que llama
  }
}

// Manejador de errores básico
bot.on('polling_error', (error) => {
  logError("Error de polling", error);
});

// Manejador para el comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const info = getChatInfo(msg);
  
  // Log detallado para comando start
  log(`Comando /start recibido:
    Chat ID: ${chatId}
    Tipo: ${info.chat.type}
    De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
    ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'info');
  
  bot.sendMessage(chatId, 
    '¡Hola! Soy un bot que puede:\n\n' +
    '1. Extraer coordenadas de enlaces de Google Maps\n' +
    '2. Procesar texto copiado de la página web usando ChatGPT\n\n' +
    'Simplemente envíame un enlace de Google Maps o copia y pega el texto completo de la página.'
  ).then(() => log('Mensaje de bienvenida enviado'))
   .catch(error => logError('Error al enviar mensaje', error));
});

// Manejador para el comando /ayuda
bot.onText(/\/ayuda/, (msg) => {
  const chatId = msg.chat.id;
  const info = getChatInfo(msg);
  
  // Log detallado para comando ayuda
  log(`Comando /ayuda recibido:
    Chat ID: ${chatId}
    Tipo: ${info.chat.type}
    De: ${info.chat.type === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
    ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'info');
  
  bot.sendMessage(chatId, 
    '📍 *COORDENADAS*\n' +
    'Envíame cualquier enlace de Google Maps y extraeré las coordenadas.\n\n' +
    '📋 *TEXTO DE LA PÁGINA*\n' +
    'Haz lo siguiente:\n' +
    '1. Una vez que hayas atorado el servicio en la página web\n' +
    '2. Selecciona todo el texto (Ctrl+A o Cmd+A)\n' +
    '3. Copia el texto (Ctrl+C o Cmd+C)\n' +
    '4. Pega el texto en este chat (Ctrl+V o Cmd+V)\n\n' +
    'ChatGPT extraerá la siguiente información y te la enviaré en mensajes separados:\n' +
    '• Número de expediente\n' +
    '• Datos del vehículo\n' +
    '• Placas\n' +
    '• Usuario/Cliente\n' +
    '• Cuenta\n' +
    '• Entre calles (si está disponible)\n' +
    '• Referencia (si está disponible)',
    { parse_mode: 'Markdown' }
  ).then(() => log('Mensaje de ayuda enviado'))
   .catch(error => logError('Error al enviar mensaje', error));
});

// Función para obtener información detallada del chat
function getChatInfo(msg) {
  const chat = msg.chat;
  const from = msg.from || {};
  const chatType = chat.type || 'desconocido';
  
  // Construir información del chat
  let chatInfo = {
    id: chat.id,
    type: chatType,
    title: chat.title || 'N/A',
    username: chat.username || 'N/A',
    firstName: chat.first_name || 'N/A',
    lastName: chat.last_name || 'N/A'
  };
  
  // Construir información del remitente
  let fromInfo = {
    id: from.id || 'N/A',
    username: from.username || 'N/A',
    firstName: from.first_name || 'N/A',
    lastName: from.last_name || 'N/A'
  };
  
  return { chat: chatInfo, from: fromInfo };
}

// Manejador para mensajes de texto
bot.on('message', async (msg) => {
  // Verificar que sea un mensaje de texto y no un comando
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Obtener y loggear información detallada
  const info = getChatInfo(msg);
  
  // Log detallado en formato JSON
  const logData = {
    timestamp: new Date().toISOString(),
    chatId: chatId,
    chatType: info.chat.type,
    chatTitle: info.chat.type === 'private' ? `${info.chat.firstName} ${info.chat.lastName}` : info.chat.title,
    username: info.chat.type === 'private' ? info.from.username : 'N/A',
    messageLength: text.length,
    messagePreview: text.substring(0, 30) + (text.length > 30 ? '...' : '')
  };
  
  // Log detallado en formato amigable para consola
  log(`MENSAJE RECIBIDO - DETALLES:
    Chat ID: ${logData.chatId}
    Tipo: ${logData.chatType}
    De: ${logData.chatTitle} ${logData.username ? `(@${logData.username})` : ''}
    Longitud: ${logData.messageLength} caracteres
    Vista previa: ${logData.messagePreview}`, 'info');
  
  // Verificar si el mensaje contiene una URL de Google Maps
  if (text.includes('google.com/maps') || text.includes('google.com.mx/maps') || text.includes('maps.app.goo.gl')) {
    log('Detectado enlace de Google Maps, extrayendo coordenadas...');
    
    // Extraer coordenadas
    const coordinates = extractCoordinates(text);
    
    if (coordinates && coordinates.length > 0) {
      log(`Coordenadas encontradas: ${coordinates.join(', ')}`);
      
      // Enviar encabezado y URL original al grupo
      if (GROUP_CHAT_ID) {
        try {
          await bot.sendMessage(GROUP_CHAT_ID, '🚨👀 Oigan...', { parse_mode: 'Markdown' });
          await bot.sendMessage(GROUP_CHAT_ID, '⚠️📍 Hay un posible servicio de *CHUBB*', { parse_mode: 'Markdown' });
          await bot.sendMessage(GROUP_CHAT_ID, '🚗💨 ¿A alguien le queda?', { parse_mode: 'Markdown' });
          await bot.sendMessage(GROUP_CHAT_ID, text);
          log('Encabezado y URL enviados al grupo');
        } catch (error) {
          logError('Error al enviar encabezado o URL al grupo', error);
        }
      }
      
      // Enviar cada coordenada en un mensaje separado
      for (const coord of coordinates) {
        try {
          await sendMessageToUserAndGroup(chatId, coord);
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
    log('Detectado texto de la página web, procesando con ChatGPT...');
    
    // Notificar que estamos procesando el texto
    const processingMsg = await bot.sendMessage(chatId, 'Procesando texto con ChatGPT... esto puede tomar unos segundos ⏳')
      .catch(error => {
        logError('Error al enviar mensaje de procesamiento', error);
        return null;
      });
    
    if (!processingMsg) return;
    
    try {
      // Procesar el texto usando ChatGPT
      const extractedData = await parseServiceText(text);
      log(`Datos extraídos por ChatGPT: ${JSON.stringify(extractedData)}`);
      
      // Formatear los datos para enviar
      const messages = formatDataToMessages(extractedData);
      
      // Eliminar el mensaje de procesamiento
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(error => logError('Error al eliminar mensaje de procesamiento', error));
      
      // Enviar cada dato en un mensaje separado
      if (messages.length > 0) {
        for (const message of messages) {
          try {
            await sendMessageToUserAndGroup(chatId, message);
          } catch (error) {
            logError(`Error al enviar dato: ${message}`, error);
          }
        }
      } else {
        await bot.sendMessage(chatId, "No se pudo extraer información del texto.")
          .catch(error => logError('Error al enviar mensaje', error));
      }
    } catch (error) {
      logError('Error al procesar el texto con ChatGPT', error);
      
      await bot.deleteMessage(chatId, processingMsg.message_id)
        .catch(err => logError('Error al eliminar mensaje de procesamiento', err));
      
      await bot.sendMessage(chatId, `Ocurrió un error al procesar el texto con ChatGPT: ${error.message}`)
        .catch(err => logError('Error al enviar mensaje de error', err));
    }
  }
});

// Exportar el bot para index.js
module.exports = bot;

// Añadir comando para obtener ID del chat
bot.onText(/\/chatid/, (msg) => {
  const chatId = msg.chat.id;
  const info = getChatInfo(msg);
  const chatType = info.chat.type;
  
  // Construir respuesta con información detallada
  let response = `📢 *Información del chat:*\n\n`;
  response += `• *ID del chat:* \`${chatId}\`\n`;
  response += `• *Tipo de chat:* ${chatType}\n`;
  
  if (chatType === 'private') {
    response += `• *Usuario:* ${info.from.firstName} ${info.from.lastName}\n`;
    if (info.from.username) {
      response += `• *Username:* @${info.from.username}\n`;
    }
  } else {
    response += `• *Título del grupo:* ${info.chat.title}\n`;
    response += `• *Enviado por:* ${info.from.firstName} ${info.from.lastName}\n`;
    if (info.from.username) {
      response += `• *Username:* @${info.from.username}\n`;
    }
  }
  
  // Enviar mensaje con información
  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' })
    .then(() => log(`Información del chat enviada a ${chatId}`))
    .catch(error => logError('Error al enviar información del chat', error));
  
  // Loggear la información completa
  log(`Comando /chatid ejecutado:
    Chat ID: ${chatId}
    Tipo: ${chatType}
    Título/Nombre: ${chatType === 'private' ? `${info.from.firstName} ${info.from.lastName}` : info.chat.title}
    ${info.from.username ? `Username: @${info.from.username}` : ''}`, 'info');
});

// Mensaje de inicio
const mode = USE_WEBHOOK ? `webhook en ${URL}` : 'polling';
log(`Bot iniciado correctamente con integración de ChatGPT en modo ${mode}. Envía /start en Telegram para comenzar.`);
log(`Para obtener el ID de un chat o grupo, simplemente envía el comando /chatid en ese chat o grupo.`);