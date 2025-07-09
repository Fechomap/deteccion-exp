/**
 * Servicio para gestionar grupos de mensajes
 */
const Logger = require('../../utils/logger');

class GroupService {
  constructor(queueService) {
    this.queueService = queueService;
    this.priorityGroups = new Map();

    Logger.info('Servicio de grupos de mensajes inicializado', 'GroupService');
  }

  /**
   * Registra un mensaje como parte de un grupo
   * @param {string} groupId - ID del grupo
   * @param {Object} message - Mensaje a agrupar
   */
  addToGroup(groupId, message) {
    if (!this.priorityGroups.has(groupId)) {
      this.priorityGroups.set(groupId, []);
    }

    this.priorityGroups.get(groupId).push(message);
    Logger.info(`Mensaje agregado al grupo ${groupId}: ${message.description}`, 'GroupService');
  }

  /**
   * Marca un grupo de mensajes como completo y los agrega a la cola
   * @param {string} groupId - ID del grupo
   * @param {string|number} chatId - ID del chat donde se enviará
   * @param {boolean} priority - Si el grupo tiene alta prioridad
   */
  completeGroup(groupId, chatId, priority = false) {
    if (!this.priorityGroups.has(groupId)) {
      Logger.warn(`No se encontró el grupo ${groupId} para completar`, 'GroupService');
      return;
    }

    const groupMessages = this.priorityGroups.get(groupId);

    // Crear un manejador que procese todos los mensajes del grupo
    const groupHandler = async () => {
      Logger.info(`Procesando grupo de mensajes ${groupId} (${groupMessages.length} mensajes)`, 'GroupService');

      for (const message of groupMessages) {
        try {
          // Ejecutar cada manejador con un pequeño retraso entre ellos
          await message.handler();
          await this._delay(50); // Pequeña pausa entre mensajes
        } catch (error) {
          Logger.logError(`Error al procesar mensaje en grupo ${groupId}: ${message.description}`, error, 'GroupService');
          // Continuamos con el siguiente mensaje a pesar del error
        }
      }
    };

    // Encolar el grupo como un solo elemento
    this.queueService.enqueue(
      chatId,
      groupHandler,
      `Grupo de mensajes ${groupId} (${groupMessages.length} mensajes)`,
      { priority }
    );

    Logger.info(`Grupo ${groupId} completado y agregado a la cola.`, 'GroupService');

    // Eliminar el grupo ya que se ha agregado a la cola
    this.priorityGroups.delete(groupId);
  }

  /**
   * Obtiene información sobre los grupos pendientes
   * @returns {Object} - Información sobre los grupos
   */
  getPendingGroupsInfo() {
    const groupInfo = {};
    for (const [groupId, messages] of this.priorityGroups.entries()) {
      groupInfo[groupId] = messages.length;
    }
    return groupInfo;
  }

  /**
   * Crea un retraso utilizando Promise
   * @private
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise} - Promesa que se resuelve después del tiempo especificado
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GroupService;
