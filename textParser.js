/**
 * Módulo para procesar texto copiado de la página web
 * Esta es una solución más directa y confiable que el procesamiento de imágenes
 */
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
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] [TextParser] ${message}\n`;
  
  // Escribir en consola
  console.log(logMessage);
  
  // Escribir en archivo
  const logFile = path.join(logsDir, `parser_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

/**
 * Extrae información relevante del texto copiado de la página web
 * @param {string} text - Texto copiado de la página
 * @returns {Object} - Objeto con la información extraída
 */
function parseServiceText(text) {
  try {
    log('Iniciando procesamiento de texto');
    log(`Longitud del texto: ${text.length} caracteres`);
    
    // Normalizar el texto (eliminar espacios extra, etc.)
    text = text.replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
    
    const data = {};
    
    // Extraer número de expediente
    const expedienteMatch = text.match(/\*\*(\d{6})\s+GRUAS\*\*/);
    if (expedienteMatch) {
      data.expediente = expedienteMatch[1];
      log(`Expediente extraído: ${data.expediente}`);
    } else {
      log('No se pudo extraer el número de expediente', 'warning');
    }
    
    // Extraer coordenadas
    const coordsMatches = text.match(/(\d+\.\d+),\s*(-\d+\.\d+)/g);
    if (coordsMatches && coordsMatches.length > 0) {
      data.coordenadas = coordsMatches;
      log(`Coordenadas extraídas: ${data.coordenadas.join(', ')}`);
    } else {
      log('No se pudieron extraer coordenadas', 'warning');
    }
    
    // Extraer datos del vehículo
    const marcaMatch = text.match(/\*\*Marca\*\*(.*?)(?=\*\*)/);
    const modeloMatch = text.match(/\*\*Modelo\*\*(.*?)(?=\*\*)/);
    const anioMatch = text.match(/\*\*Año\*\*(.*?)(?=\*\*)/);
    const colorMatch = text.match(/\*\*Color\*\*(.*?)(?=\**Datos Cliente|\*\*Costo Servicio Muerto|\n)/);
    
    if (marcaMatch && modeloMatch && anioMatch && colorMatch) {
      const marca = marcaMatch[1].trim();
      const modelo = modeloMatch[1].trim();
      const anio = anioMatch[1].trim();
      const color = colorMatch[1].trim();
      
      data.vehiculo = `${marca} ${modelo} ${anio} ${color}`;
      log(`Datos del vehículo extraídos: ${data.vehiculo}`);
    } else {
      log('No se pudieron extraer todos los datos del vehículo', 'warning');
    }
    
    // Extraer datos del cliente
    const clienteMatch = text.match(/\*\*Cliente\*\*(.*?)(?=\*\*)/);
    if (clienteMatch) {
      data.cliente = clienteMatch[1].trim();
      log(`Cliente extraído: ${data.cliente}`);
    } else {
      log('No se pudo extraer el cliente', 'warning');
    }
    
    // Extraer usuario (la persona que recibe el servicio)
    const usuarioMatch = text.match(/¿Quién recibe y acompaña el servicio\? ([^¿\n]+)/);
    if (usuarioMatch) {
      data.usuario = usuarioMatch[1].trim();
      log(`Usuario extraído: ${data.usuario}`);
    } else {
      log('No se pudo extraer el usuario', 'warning');
    }
    
    // Extraer compañía
    const companiaMatch = text.match(/\*\*Compañia\*\*(.*?)(?=\*\*)/);
    if (companiaMatch) {
      data.compania = companiaMatch[1].trim();
      log(`Compañía extraída: ${data.compania}`);
    } else {
      log('No se pudo extraer la compañía', 'warning');
    }
    
    // Extraer origen (direcciones)
    const origenColoniaMatch = text.match(/\*\*Colonia\*\*(.*?)(?=\*\*Colonia)/);
    const origenCalleMatch = text.match(/\*\*Calle\*\*(.*?)(?=\*\*Calle)/);
    
    if (origenColoniaMatch) {
      data.origen = origenColoniaMatch[1].trim();
      if (origenCalleMatch) {
        data.origen += `, ${origenCalleMatch[1].trim()}`;
      }
      log(`Origen extraído: ${data.origen}`);
    } else {
      log('No se pudo extraer el origen', 'warning');
    }
    
    // Extraer destino
    const destinoColoniaMatch = text.match(/\*\*Colonia\*\*.*?\*\*Colonia\*\*(.*?)(?=\*\*Calle|Numero)/);
    const destinoCalleMatch = text.match(/\*\*Calle\*\*.*?\*\*Calle\*\*(.*?)(?=\*\*Numero)/);
    
    if (destinoColoniaMatch) {
      data.destino = destinoColoniaMatch[1].trim();
      if (destinoCalleMatch) {
        data.destino += `, ${destinoCalleMatch[1].trim()}`;
      }
      log(`Destino extraído: ${data.destino}`);
    } else {
      log('No se pudo extraer el destino', 'warning');
    }
    
    // Extraer referencias
    const referenciaMatch = text.match(/\*\*Referencia\*\*(.*?)(?=\*\*Observaciones)/);
    if (referenciaMatch) {
      data.referencia = referenciaMatch[1].trim();
      log(`Referencia extraída: ${data.referencia}`);
    } else {
      log('No se pudo extraer la referencia', 'warning');
    }
    
    // Buscar placas en las observaciones
    const observacionesMatch = text.match(/\*\*Observaciones\*\*(.*?)(?=Datos Servicio|$)/s);
    if (observacionesMatch) {
      const observaciones = observacionesMatch[1];
      // Buscar patrones que podrían ser placas en las observaciones
      const placasMatches = observaciones.match(/[A-Z0-9]{3,7}/g);
      if (placasMatches && placasMatches.length > 0) {
        // Filtrar resultados que parecen placas (alfanuméricos, 3-7 caracteres)
        const potentialPlates = placasMatches.filter(plate => 
          /^[A-Z0-9]{3,7}$/.test(plate) && 
          !['INE', 'SRTA', 'HORAS', 'GUILLON', 'METROS', 'SOTANO'].includes(plate)
        );
        
        if (potentialPlates.length > 0) {
          data.placas = potentialPlates[0]; // Tomar la primera coincidencia
          log(`Posibles placas extraídas: ${data.placas}`);
        }
      }
    }
    
    // Extraer costo
    const costoMatch = text.match(/\*\*Costo\*\*\$([\d,\.]+)/);
    if (costoMatch) {
      data.costo = costoMatch[1].trim();
      log(`Costo extraído: ${data.costo}`);
    } else {
      log('No se pudo extraer el costo', 'warning');
    }
    
    log('Procesamiento de texto completado');
    return data;
  } catch (error) {
    log(`Error al procesar el texto: ${error.message}`, 'error');
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
  
  if (data.expediente) {
    messages.push(data.expediente);
  }
  
  if (data.cliente) {
    messages.push(data.cliente);
  }
  
  if (data.vehiculo) {
    messages.push(data.vehiculo);
  }
  
  if (data.placas) {
    messages.push(data.placas);
  }
  
  if (data.usuario) {
    messages.push(data.usuario);
  }
  
  if (data.compania) {
    messages.push(data.compania);
  }
  
  // Enviamos las coordenadas como mensajes individuales
  if (data.coordenadas && data.coordenadas.length > 0) {
    data.coordenadas.forEach(coord => {
      messages.push(coord);
    });
  }
  
  if (data.origen) {
    messages.push(data.origen);
  }
  
  if (data.destino) {
    messages.push(data.destino);
  }
  
  if (data.referencia) {
    messages.push(data.referencia);
  }
  
  log(`Generados ${messages.length} mensajes a partir de los datos`);
  return messages;
}

module.exports = { parseServiceText, formatDataToMessages };