// src/services/service-cache.service.js
/**
 * Servicio para almacenamiento temporal de datos de servicios
 */
const Logger = require('../utils/logger');

class ServiceCacheService {
  constructor() {
    this.serviceCache = new Map();
    Logger.info('Servicio de caché de servicios inicializado', 'ServiceCache');
  }

  storeService(serviceId, serviceData) {
    this.serviceCache.set(serviceId, serviceData);
    Logger.info(`Servicio ${serviceId} almacenado en caché`, 'ServiceCache');

    // Limpieza automática después de 24 horas
    setTimeout(() => {
      this.removeService(serviceId);
    }, 24 * 60 * 60 * 1000);
  }

  getService(serviceId) {
    return this.serviceCache.get(serviceId) || null;
  }

  removeService(serviceId) {
    if (this.serviceCache.has(serviceId)) {
      this.serviceCache.delete(serviceId);
      Logger.info(`Servicio ${serviceId} eliminado de la caché`, 'ServiceCache');
    }
  }
}

module.exports = new ServiceCacheService();
