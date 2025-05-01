/**
 * Módulo para procesar texto copiado de la página web usando OpenAI
 * Esta solución utiliza ChatGPT para analizar el texto y extraer los datos relevantes
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configurar directorio de logs
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Función para logs
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] [TextParserGPT] ${message}\n`;
  
  // Escribir en consola
  console.log(logMessage);
  
  // Escribir en archivo
  const logFile = path.join(logsDir, `parser_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

/**
 * Extrae información relevante del texto copiado de la página web usando OpenAI
 * @param {string} text - Texto copiado de la página
 * @returns {Promise<Object>} - Objeto con la información extraída
 */
async function parseServiceText(text) {
  try {
    log('Iniciando procesamiento de texto con OpenAI');
    log(`Longitud del texto: ${text.length} caracteres`);
    
    // Sistema de prompt para el modelo GPT
    const systemPrompt = `Eres un asistente especializado en extraer datos específicos de textos sobre servicios de grúas y vehículos.
    
    Extrae SOLAMENTE los siguientes datos y entrégalos en formato JSON:
    1. El número de expediente (6 dígitos que empiezan con 9, suele estar junto a la palabra GRUAS)
    2. Los datos del vehículo como un único string en formato: "[Marca] [Modelo] [Año] [Color]"
    3. Las placas (si están disponibles)
    4. El nombre completo del cliente o usuario (prioriza el campo "Cliente" sobre "quién recibe")
    5. Entre calles (si están disponibles)
    6. Referencia (si está disponible)
    
    IMPORTANTE:
    - El campo cuenta siempre es "CHUBB" cuando hay un expediente
    - Ignora términos que no son placas reales como "TROYA03", "CRK", "4X2", "PAZ", "REYES", etc.
    - No incluyas las coordenadas en tu respuesta
    - Si un dato no está disponible en el texto, incluye el campo con valor null
    - IMPORTANTE: Todos los campos deben ser strings, no arrays.
    - Tu respuesta debe ser SOLAMENTE un objeto JSON válido con los campos: expediente, vehiculo, placas, usuario, cuenta, entreCalles, referencia`;
    
    // Realizar la llamada a la API de OpenAI
    log('Enviando solicitud a OpenAI...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Usamos gpt-3.5-turbo que es más rápido y económico
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Analiza el siguiente texto y extrae la información solicitada en formato JSON, asegurándote de que todos los campos sean strings, no arrays:\n\n${text}`
        }
      ],
      temperature: 0.2, // Baja temperatura para respuestas más consistentes
      max_tokens: 500
    });
    
    // Obtener la respuesta de GPT
    const responseContent = completion.choices[0].message.content;
    log(`Respuesta recibida de OpenAI: ${responseContent}`);
    
    // Parsear la respuesta JSON
    // Primero intentamos encontrar el objeto JSON en la respuesta
    let jsonStr = responseContent;
    const jsonRegex = /\{[\s\S]*\}/; // Regex para encontrar cualquier texto entre { }
    const jsonMatch = responseContent.match(jsonRegex);
    
    if (jsonMatch) {
      jsonStr = jsonMatch[0]; // Usar solo la parte del texto que coincide con un objeto JSON
    }
    
    try {
      const extractedData = JSON.parse(jsonStr);
      
      // Normalizar los datos
      // Asegurarse de que vehículo sea un string
      if (Array.isArray(extractedData.vehiculo)) {
        extractedData.vehiculo = extractedData.vehiculo.join(' ');
        log(`Vehículo convertido de array a string: ${extractedData.vehiculo}`);
      }
      
      // Asegurarse de que la cuenta sea CHUBB
      if (extractedData.expediente && extractedData.expediente.startsWith('9')) {
        extractedData.cuenta = 'CHUBB';
      }
      
      log('Procesamiento de texto completado');
      return extractedData;
    } catch (jsonError) {
      log(`Error al parsear JSON: ${jsonError.message}`, 'error');
      log(`Contenido que no se pudo parsear: ${jsonStr}`, 'error');
      throw new Error(`No se pudo parsear la respuesta JSON: ${jsonError.message}`);
    }
  } catch (error) {
    log(`Error al procesar el texto con OpenAI: ${error.message}`, 'error');
    log(`Stack: ${error.stack}`, 'error');
    throw error;
  }
}

/**
 * Convierte los datos extraídos en un array de mensajes para enviar
 * @param {Object} data - Datos extraídos del texto
 * @returns {string[]} - Array de mensajes para enviar
 */
function formatDataToMessages(data) {
  const messages = [];
  
  // 1. Expediente (obligatorio)
  if (data.expediente) {
    messages.push(data.expediente);
  } else {
    messages.push("No se encontró expediente");
  }
  
  // 2. Datos del vehículo (obligatorio)
  if (data.vehiculo) {
    // Si vehículo es un array, convertirlo a string
    if (Array.isArray(data.vehiculo)) {
      messages.push(data.vehiculo.join(' '));
    } else {
      messages.push(data.vehiculo);
    }
  } else {
    messages.push("No se encontraron datos del vehículo");
  }
  
  // 3. Placas (obligatorio)
  if (data.placas) {
    messages.push(data.placas);
  } else {
    messages.push("No se encontraron placas");
  }
  
  // 4. Usuario (obligatorio)
  if (data.usuario) {
    messages.push(data.usuario);
  } else {
    messages.push("No se encontró usuario");
  }
  
  // 5. Cuenta (siempre CHUBB cuando hay expediente que empieza con 9)
  if (data.cuenta) {
    messages.push(data.cuenta);
  } else {
    messages.push("CHUBB");  // Por defecto
  }
  
  // 6. Entre calles (opcional)
  if (data.entreCalles) {
    messages.push(data.entreCalles);
  } else {
    messages.push("No hay entre calles");
  }
  
  // 7. Referencia (opcional)
  if (data.referencia) {
    messages.push(data.referencia);
  } else {
    messages.push("No hay referencia");
  }
  
  log(`Generados ${messages.length} mensajes a partir de los datos`);
  return messages;
}

module.exports = { parseServiceText, formatDataToMessages };