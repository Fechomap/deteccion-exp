// src/handlers/callbacks/service-action.handler.js
const Logger = require('../../utils/logger');

class ServiceActionHandler {
  constructor(services) {
    this.services = services;
    this.logger = Logger;
  }

  register(bot) {
    bot.on('callback_query', async (query) => {
      try {
        await this.handleCallback(bot, query);
      } catch (error) {
        this.logger.logError('Error al manejar callback', error, 'ServiceActionHandler');
      }
    });

    this.logger.info('Manejador de callbacks para acciones de servicio registrado', 'ServiceActionHandler');
  }

  async handleCallback(bot, query) {
    const callbackData = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userId = query.from.id;
    const userName = query.from.first_name;

    this.logger.info(`Callback recibido: ${callbackData} de usuario ${userName} (${userId})`, 'ServiceActionHandler');

    // Verificar si es una acción de servicio
    if (callbackData.startsWith('take_service:') || callbackData.startsWith('reject_service:')) {
      const action = callbackData.split(':')[0];
      const serviceId = callbackData.split(':')[1];

      // Log detallado
      this.logger.info(`Acción: ${action}, ID de servicio: ${serviceId}`, 'ServiceActionHandler');

      const serviceCache = this.services.serviceCache;

      // Verificar si serviceCache está disponible
      if (!serviceCache) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Servicio no disponible. Contacta al administrador.',
          show_alert: true
        });
        this.logger.error('ServiceCache no disponible', 'ServiceActionHandler');
        return;
      }

      const serviceData = serviceCache.getService(serviceId);

      if (!serviceData) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Este servicio ya no está disponible.',
          show_alert: true
        });
        this.logger.warn(`Servicio ${serviceId} no encontrado en caché`, 'ServiceActionHandler');
        return;
      }

      if (action === 'take_service') {
        // Usuario toma el servicio
        await this._handleTakeService(bot, query, serviceData);
      } else if (action === 'reject_service') {
        // Usuario rechaza el servicio
        await this._handleRejectService(bot, query, serviceData);
      }
    }
  }

  async _handleTakeService(bot, query, serviceData) {
    const { queue } = this.services;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userName = query.from.first_name;

    // Responder al callback
    await bot.answerCallbackQuery(query.id, {
      text: '✅ Servicio tomado! Mostrando detalles completos...',
      show_alert: false
    });

    this.logger.info(`Servicio ${serviceData.id} tomado por ${userName}`, 'ServiceActionHandler');

    // Actualizar el mensaje original manteniendo la URL
    const vehicleInfo = serviceData.messages && serviceData.messages.length > 1 ? 
      serviceData.messages[1] : 'No hay información del vehículo';
    
    const updatedMessage = `🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n🚨 *Nuevo Servicio Disponible*\n\n` +
                          `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
                          (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
                          `✅ *SERVICIO TOMADO POR ${userName}*`;

    try {
      await bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: [] }  // Eliminar botones
      });

      this.logger.info(`Mensaje actualizado para servicio ${serviceData.id}`, 'ServiceActionHandler');
    } catch (error) {
      this.logger.logError('Error al actualizar mensaje', error, 'ServiceActionHandler');
      // Continuar a pesar del error para entregar los datos
    }

    // Enviar todos los datos completos
    const detailsGroupId = `details_${Date.now()}_${chatId}`;

    this.logger.info(`Preparando envío de detalles completos (grupo ${detailsGroupId})`, 'ServiceActionHandler');

    // 1. Enviar coordenadas PRIMERO
    if (serviceData.coordinates && serviceData.coordinates.length > 0) {
      this.logger.info(`Encolando ${serviceData.coordinates.length} coordenadas para envío (PRIMERO)`, 'ServiceActionHandler');

      queue.enqueue(
        chatId,
        async () => await bot.sendMessage(chatId, '📍 *COORDENADAS:*', { parse_mode: 'Markdown' }),
        'Cabecera de coordenadas',
        { groupId: detailsGroupId }
      );

      for (const coord of serviceData.coordinates) {
        queue.enqueue(
          chatId,
          async () => await bot.sendMessage(chatId, coord),
          `Coordenada: ${coord}`,
          { groupId: detailsGroupId }
        );
      }
    }

    // 2. Enviar datos de ChatGPT DESPUÉS
    if (serviceData.messages && serviceData.messages.length > 0) {
      this.logger.info(`Encolando ${serviceData.messages.length} mensajes para envío (DESPUÉS)`, 'ServiceActionHandler');

      // Enviar cada uno de los mensajes directamente
      for (let i = 0; i < serviceData.messages.length; i++) {
        const message = serviceData.messages[i];
        queue.enqueue(
          chatId,
          async () => await bot.sendMessage(chatId, message),
          `Dato ${i+1}: ${message.substr(0, 20)}${message.length > 20 ? '...' : ''}`,
          { groupId: detailsGroupId }
        );
      }
    }

    // 3. Mensaje de confirmación final
    queue.enqueue(
      chatId,
      async () => await bot.sendMessage(chatId, '✅🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n*Todos los datos han sido enviados correctamente.*', { parse_mode: 'Markdown' }),
      'Confirmación final',
      { groupId: detailsGroupId }
    );

    // Completar el grupo con prioridad alta
    queue.completeGroup(detailsGroupId, chatId, true);
    this.logger.info(`Grupo de detalles ${detailsGroupId} completado y encolado para envío`, 'ServiceActionHandler');
  }

  async _handleRejectService(bot, query, serviceData) {
    const { serviceCache } = this.services;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userName = query.from.first_name;

    // Responder al callback
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Servicio rechazado.',
      show_alert: false
    });

    this.logger.info(`Servicio ${serviceData.id} rechazado por ${userName}`, 'ServiceActionHandler');

    // Actualizar el mensaje original manteniendo la URL
    const vehicleInfo = serviceData.messages && serviceData.messages.length > 1 ? 
      serviceData.messages[1] : 'No hay información del vehículo';
    
    const updatedMessage = `🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n🚨 *Nuevo Servicio Disponible*\n\n` +
                          `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
                          (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
                          `❌ *SERVICIO RECHAZADO POR ${userName}*\n\n⚠️ *Este servicio ha sido rechazado y no será procesado.*`;

    try {
      await bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: [] }  // Eliminar botones
      });

      this.logger.info(`Mensaje actualizado para servicio rechazado ${serviceData.id}`, 'ServiceActionHandler');
    } catch (error) {
      this.logger.logError('Error al actualizar mensaje de rechazo', error, 'ServiceActionHandler');
    }

    // Eliminar servicio de la caché
    serviceCache.removeService(serviceData.id);
    this.logger.info(`Servicio ${serviceData.id} eliminado de caché`, 'ServiceActionHandler');
  }
}

module.exports = ServiceActionHandler;
