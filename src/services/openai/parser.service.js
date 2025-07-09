/**
 * Servicio para procesar texto con OpenAI
 */
const { OpenAI } = require('openai');
const config = require('../../config');
const Logger = require('../../utils/logger');

class OpenAIParserService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });

    Logger.info('Servicio de procesamiento con OpenAI inicializado', 'OpenAIParser');
  }

  /**
   * Extrae información relevante del texto copiado de la página web usando OpenAI
   * @param {string} text - Texto copiado de la página
   * @returns {Promise<Object>} - Objeto con la información extraída
   */
  async parseServiceText(text) {
    try {
      Logger.info('Iniciando procesamiento de texto con OpenAI', 'OpenAIParser');
      Logger.info(`Longitud del texto: ${text.length} caracteres`, 'OpenAIParser');

      // Sistema de prompt para el modelo GPT
      const systemPrompt = this._getSystemPrompt();

      // Realizar la llamada a la API de OpenAI
      Logger.info('Enviando solicitud a OpenAI...', 'OpenAIParser');
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Usamos gpt-3.5-turbo que es más rápido y económico
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Analiza el siguiente texto y extrae la información solicitada en formato JSON, asegurándote de que todos los campos sean strings, no arrays:\n\n${text}`
          }
        ],
        temperature: 0.2, // Baja temperatura para respuestas más consistentes
        max_tokens: 500
      });

      // Obtener la respuesta de GPT
      const responseContent = completion.choices[0].message.content;
      Logger.info(`Respuesta recibida de OpenAI: ${responseContent}`, 'OpenAIParser');

      // Procesar la respuesta
      return this._processGptResponse(responseContent);
    } catch (error) {
      Logger.logError('Error al procesar el texto con OpenAI', error, 'OpenAIParser');
      throw error;
    }
  }

  /**
   * Obtiene el prompt del sistema para ChatGPT
   * @private
   * @returns {string} - Prompt del sistema
   */
  _getSystemPrompt() {
    return `Eres un asistente especializado en extraer datos específicos de textos sobre servicios de grúas y vehículos.
    
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
  }

  /**
   * Procesa la respuesta de GPT para extraer el JSON
   * @private
   * @param {string} responseContent - Respuesta de GPT
   * @returns {Object} - Datos extraídos y normalizados
   */
  _processGptResponse(responseContent) {
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
        Logger.info(`Vehículo convertido de array a string: ${extractedData.vehiculo}`, 'OpenAIParser');
      }

      // Asegurarse de que la cuenta sea CHUBB
      if (extractedData.expediente && extractedData.expediente.startsWith('9')) {
        extractedData.cuenta = 'CHUBB';
      }

      Logger.info('Procesamiento de texto completado', 'OpenAIParser');
      return extractedData;
    } catch (jsonError) {
      Logger.error(`Error al parsear JSON: ${jsonError.message}`, 'OpenAIParser');
      Logger.error(`Contenido que no se pudo parsear: ${jsonStr}`, 'OpenAIParser');
      throw new Error(`No se pudo parsear la respuesta JSON: ${jsonError.message}`);
    }
  }

  /**
   * Convierte los datos extraídos en un array de mensajes para enviar
   * @param {Object} data - Datos extraídos del texto
   * @returns {string[]} - Array de mensajes para enviar
   */
  formatDataToMessages(data) {
    const messages = [];

    // 1. Expediente (obligatorio)
    if (data.expediente) {
      messages.push(data.expediente);
    } else {
      messages.push('No se encontró expediente');
    }

    // 2. Datos del vehículo (obligatorio)
    if (data.vehiculo) {
      messages.push(data.vehiculo);
    } else {
      messages.push('No se encontraron datos del vehículo');
    }

    // 3. Placas (obligatorio)
    if (data.placas) {
      messages.push(data.placas);
    } else {
      messages.push('No se encontraron placas');
    }

    // 4. Usuario (obligatorio)
    if (data.usuario) {
      messages.push(data.usuario);
    } else {
      messages.push('No se encontró usuario');
    }

    // 5. Cuenta (siempre CHUBB cuando hay expediente que empieza con 9)
    if (data.cuenta) {
      messages.push(data.cuenta);
    } else {
      messages.push('CHUBB');  // Por defecto
    }

    // 6. Entre calles (opcional)
    if (data.entreCalles) {
      messages.push(data.entreCalles);
    } else {
      messages.push('No hay entre calles');
    }

    // 7. Referencia (opcional)
    if (data.referencia) {
      messages.push(data.referencia);
    } else {
      messages.push('No hay referencia');
    }

    Logger.info(`Generados ${messages.length} mensajes a partir de los datos`, 'OpenAIParser');
    return messages;
  }
}

// Exportar una instancia única del servicio
module.exports = new OpenAIParserService();
