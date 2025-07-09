/**
 * Sistema centralizado de logs
 */
const fs = require('fs');
const path = require('path');

// Configurar directorio de logs
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Sistema centralizado de logs
 */
class Logger {
  /**
   * Registra un mensaje en el nivel especificado
   * @param {string} message - Mensaje a registrar
   * @param {string} type - Nivel de log (info, warn, error)
   * @param {string} component - Nombre del componente que genera el log
   */
  static log(message, type = 'info', component = 'App') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] [${component}] ${message}\n`;

    // Escribir en consola
    console.log(logMessage);

    // Escribir en archivo
    const logFile = path.join(logsDir, `${component.toLowerCase()}_${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logMessage);
  }

  /**
   * Registra un mensaje de nivel info
   * @param {string} message - Mensaje a registrar
   * @param {string} component - Nombre del componente
   */
  static info(message, component) {
    this.log(message, 'info', component);
  }

  /**
   * Registra un mensaje de nivel warn
   * @param {string} message - Mensaje a registrar
   * @param {string} component - Nombre del componente
   */
  static warn(message, component) {
    this.log(message, 'warn', component);
  }

  /**
   * Registra un mensaje de nivel error
   * @param {string} message - Mensaje a registrar
   * @param {string} component - Nombre del componente
   */
  static error(message, component) {
    this.log(message, 'error', component);
  }

  /**
   * Registra un error con detalles adicionales
   * @param {string} message - Mensaje descriptivo
   * @param {Error} error - Objeto de error
   * @param {string} component - Nombre del componente
   */
  static logError(message, error, component) {
    const errorMsg = `${message}: ${error.message}`;
    this.error(errorMsg, component);

    if (error.stack) {
      this.error(`Stack: ${error.stack}`, component);
    }
  }
}

module.exports = Logger;
