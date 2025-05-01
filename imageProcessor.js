/**
 * Módulo para procesar imágenes y extraer información usando OpenAI
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Procesa una imagen de Telegram y extrae información relevante usando OpenAI
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {string} token - Token de Telegram
 * @param {string} fileId - ID del archivo de imagen
 * @returns {Promise<string>} - Información extraída
 */
async function processImage(bot, token, fileId) {
  try {
    console.log(`Procesando foto con ID: ${fileId}`);
    
    const fileInfo = await bot.getFile(fileId);
    
    // Ruta del archivo en el servidor de Telegram
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    console.log(`URL del archivo: ${fileUrl}`);
    
    // Descargar la imagen
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'arraybuffer'
    });
    
    // Guardar temporalmente la imagen
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    
    const localFilePath = path.join(tmpDir, `${Date.now()}.jpg`);
    fs.writeFileSync(localFilePath, Buffer.from(response.data));
    console.log(`Imagen guardada localmente en: ${localFilePath}`);
    
    // Enviar la imagen a OpenAI para análisis
    const imageData = fs.readFileSync(localFilePath);
    const base64Image = Buffer.from(imageData).toString('base64');
    
    console.log('Enviando imagen a OpenAI para análisis...');
    
    // Intentar con GPT-4o primero
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Eres un asistente especializado en extraer datos específicos de imágenes de documentos de servicios vehiculares.
            
            Extrae SOLAMENTE los siguientes datos y entrégalos en líneas individuales, sin etiquetas ni títulos:
            
            1. El número de expediente (número grande, generalmente de 6 dígitos, a menudo comienza con 9)
            2. El nombre del cliente
            3. Los datos del vehículo en este formato exacto: [Marca] [Submarca] [Año] [Color] (ej. "Nissan Sentra 2018 Blanco")
            4. Las placas (alfanuméricas, máximo 7 dígitos, sin guiones ni espacios)
            5. El nombre del usuario
            6. El número de cuenta
            7. Origen o dirección 
            8. Entre calles (si están disponibles)
            9. Referencias (si están disponibles)
            
            IMPORTANTE:
            - Entrega SOLO los datos, uno por línea
            - NO incluyas etiquetas, títulos o descripciones
            - Si un dato no está disponible, simplemente omítelo
            - NO incluyas texto como "No encontrado" o "No disponible"
            - Asegúrate de que los datos del vehículo estén en el formato correcto`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              },
              {
                type: "text",
                text: "Extrae la información clave de esta imagen según las instrucciones."
              }
            ]
          }
        ],
        max_tokens: 300
      });
      
      // Limpiar archivo temporal
      fs.unlinkSync(localFilePath);
      console.log('Archivo temporal eliminado');
      
      // Obtener la respuesta de OpenAI
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error con GPT-4o, intentando con GPT-4:', error.message);
      
      // Si GPT-4o falla, intentar con GPT-4
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Eres un asistente especializado en extraer datos específicos de imágenes de documentos de servicios vehiculares.
            
            Extrae SOLAMENTE los siguientes datos y entrégalos en líneas individuales, sin etiquetas ni títulos:
            
            1. El número de expediente (número grande, generalmente de 6 dígitos, a menudo comienza con 9)
            2. El nombre del cliente
            3. Los datos del vehículo en este formato exacto: [Marca] [Submarca] [Año] [Color] (ej. "Nissan Sentra 2018 Blanco")
            4. Las placas (alfanuméricas, máximo 7 dígitos, sin guiones ni espacios)
            5. El nombre del usuario
            6. El número de cuenta
            7. Origen o dirección 
            8. Entre calles (si están disponibles)
            9. Referencias (si están disponibles)
            
            IMPORTANTE:
            - Entrega SOLO los datos, uno por línea
            - NO incluyas etiquetas, títulos o descripciones
            - Si un dato no está disponible, simplemente omítelo
            - NO incluyas texto como "No encontrado" o "No disponible"
            - Asegúrate de que los datos del vehículo estén en el formato correcto`
          },
          {
            role: "user",
            content: `Analiza la siguiente imagen y extrae la información solicitada: ${fileUrl}`
          }
        ],
        max_tokens: 300
      });
      
      // Limpiar archivo temporal
      fs.unlinkSync(localFilePath);
      console.log('Archivo temporal eliminado');
      
      // Obtener la respuesta de OpenAI
      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error('Error en processImage:', error);
    throw error;
  }
}

module.exports = { processImage };