/**
 * Servicio de integración con RecLocation API para cálculo de tiempos de arribo
 */
const axios = require('axios');
const config = require('../config');
const Logger = require('../utils/logger');

class RecLocationService {
  /**
   * Solicita un reporte de timing a RecLocation
   * @param {string} coordinates - Coordenadas en formato "latitud,longitud"
   * @param {string} [chatId=null] - ID del chat donde enviar los resultados (usa el predeterminado si es null)
   * @returns {Promise} - Promesa que se resuelve cuando se ha solicitado el reporte
   */
  static async requestTimingReport(coordinates, chatId = null) {
    try {
      // IMPORTANTE: Usar el ID de grupo de Detección-Exp para que los resultados se envíen ahí
      // Usar el ID del grupo de Telegram, NO el ID de RecLocation
      const targetChatId = chatId || config.TELEGRAM_GROUP_ID;
      
      Logger.info(`Solicitando tiempo de arribo para coordenadas: ${coordinates}, usando chatId: ${targetChatId}`, 'RecLocation');
      
      // Verificar formato de coordenadas
      const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
      if (!coordPattern.test(coordinates)) {
        throw new Error(`Formato de coordenadas inválido: ${coordinates}`);
      }

      // Preparar la solicitud
      const requestData = {
        coordinates: coordinates,
        chatId: targetChatId.toString() // Asegurar que chatId sea un string
      };
      
      Logger.info(`Enviando solicitud a RecLocation API: ${JSON.stringify(requestData)}`, 'RecLocation');
      
      // Realizar solicitud
      const response = await axios({
        method: 'post',
        url: config.RECLOCATION_API_URL,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': config.RECLOCATION_API_TOKEN
        },
        data: requestData,
        // Añadir timeout para evitar esperas muy largas
        timeout: 10000
      });
      
      // Registrar la respuesta
      Logger.info(`Respuesta de RecLocation API: ${JSON.stringify(response.data)}`, 'RecLocation');
      
      if (response.data.success) {
        Logger.info(`✅ Reporte de timing solicitado exitosamente para chatId ${targetChatId}`, 'RecLocation');
      } else {
        Logger.warn(`⚠️ La API respondió con éxito pero el resultado indica un problema: ${JSON.stringify(response.data)}`, 'RecLocation');
      }
      
      return response.data;
    } catch (error) {
      // Log detallado del error
      Logger.logError('Error al solicitar reporte de timing', error, 'RecLocation');
      
      // Si hay información de respuesta, registrarla para diagnóstico
      if (error.response) {
        Logger.error(`Error API - Status: ${error.response.status}`, 'RecLocation');
        Logger.error(`Error API - Data: ${JSON.stringify(error.response.data)}`, 'RecLocation');
      }
      
      throw error;
    }
  }

  /**
   * Verifica la conectividad con RecLocation API
   * @returns {Promise<boolean>} - true si la API está disponible, false en caso contrario
   */
  static async checkConnectivity() {
    try {
      Logger.info('Verificando conectividad con RecLocation API...', 'RecLocation');
      
      // Prueba simple con el endpoint de health
      let healthUrl = config.RECLOCATION_API_URL.replace('/api/timing', '/health');
      if (healthUrl === config.RECLOCATION_API_URL) {
        // Si no cambió, probablemente la URL no tiene '/api/timing'
        healthUrl = 'https://web-production-23d41.up.railway.app/health';
      }
      
      const response = await axios({
        method: 'get',
        url: healthUrl,
        timeout: 5000
      });
      
      if (response.status === 200) {
        Logger.info('✅ RecLocation API está accesible y funcionando', 'RecLocation');
        return true;
      } else {
        Logger.warn(`⚠️ RecLocation API respondió con estado: ${response.status}`, 'RecLocation');
        return false;
      }
    } catch (error) {
      Logger.warn(`⚠️ No se pudo conectar con RecLocation API: ${error.message}`, 'RecLocation');
      Logger.warn('El bot funcionará, pero las funciones de timing podrían no estar disponibles', 'RecLocation');
      return false;
    }
  }
}

module.exports = RecLocationService;