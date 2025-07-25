// src/handlers/callbacks/service-action.handler.js
const Logger = require('../../utils/logger');
const AuthService = require('../../services/auth.service');

class ServiceActionHandler {
  constructor(services) {
    this.services = services;
    this.logger = Logger;
  }

  register(bot) {
    bot.on('callback_query', async (query) => {
      try {
        // Validar autorización del usuario
        if (!AuthService.validateCallback(query)) {
          this.logger.warn(
            `Acceso denegado para callback - chat ID: ${query.message.chat.id}`,
            'ServiceActionHandler'
          );
          await bot.answerCallbackQuery(query.id, {
            text: '❌ No tienes autorización para usar este bot.',
            show_alert: true
          });
          return;
        }

        await this.handleCallback(bot, query);
      } catch (error) {
        this.logger.logError('Error al manejar callback', error, 'ServiceActionHandler');
      }
    });

    this.logger.info(
      'Manejador de callbacks para acciones de servicio registrado',
      'ServiceActionHandler'
    );
  }

  async handleCallback(bot, query) {
    const callbackData = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userId = query.from.id;
    const userName = query.from.first_name;

    this.logger.info(
      `Callback recibido: ${callbackData} de usuario ${userName} (${userId})`,
      'ServiceActionHandler'
    );

    // Verificar si es una acción de servicio
    if (
      callbackData.startsWith('take_service:') ||
      callbackData.startsWith('reject_service:') ||
      callbackData.startsWith('select_time:')
    ) {
      const parts = callbackData.split(':');
      const action = parts[0];
      const serviceId = parts[1];

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
        // Mostrar opciones de tiempo
        await this._handleTimeSelection(bot, query, serviceData);
      } else if (action === 'reject_service') {
        // Usuario rechaza el servicio
        await this._handleRejectService(bot, query, serviceData);
      } else if (action === 'select_time') {
        // Usuario seleccionó un tiempo específico
        const selectedTime = parts[2];
        await this._handleTakeServiceWithTime(bot, query, serviceData, selectedTime);
      }
    }
  }

  async _handleTimeSelection(bot, query, serviceData) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userName = query.from.first_name;

    // Responder al callback
    await bot.answerCallbackQuery(query.id, {
      text: '📋 Selecciona el tiempo para tomar el servicio...',
      show_alert: false
    });

    this.logger.info(
      `Mostrando opciones de tiempo para servicio ${serviceData.id} - usuario ${userName}`,
      'ServiceActionHandler'
    );

    // Actualizar el mensaje original con diseño mejorado y amarillo
    const vehicleInfo =
      serviceData.messages && serviceData.messages.length > 1
        ? serviceData.messages[1]
        : 'No hay información del vehículo';

    const updatedMessage =
      `🚨🚨🚨 *¡NUEVO SERVICIO DISPONIBLE!* 🚨🚨🚨

` +
      `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
      (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
      `⚡ *${userName} sugiere tomar el servicio* ⚡\n\n` +
      '🟡 *SELECCIONA EL TIEMPO PARA TOMAR EL SERVICIO* 🟡\n\n' +
      '🔸 *Elige una opción:* 🔸';

    // Crear botones de tiempo más cortos y funcionales
    const timeButtons = [
      [{ text: '60 minutos', callback_data: `select_time:${serviceData.id}:60` }],
      [{ text: '90 minutos', callback_data: `select_time:${serviceData.id}:90` }],
      [{ text: '120 minutos', callback_data: `select_time:${serviceData.id}:120` }]
    ];

    try {
      await bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: timeButtons }
      });

      this.logger.info(
        `Mensaje actualizado con opciones de tiempo mejoradas para servicio ${serviceData.id}`,
        'ServiceActionHandler'
      );
    } catch (error) {
      this.logger.logError(
        'Error al actualizar mensaje con opciones de tiempo mejoradas',
        error,
        'ServiceActionHandler'
      );
    }
  }

  async _handleTakeServiceWithTime(bot, query, serviceData, selectedTime) {
    const { queue } = this.services;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userName = query.from.first_name;

    // Responder al callback
    await bot.answerCallbackQuery(query.id, {
      text: `✅ Servicio tomado con ${selectedTime} minutos! Mostrando detalles completos...`,
      show_alert: false
    });

    this.logger.info(
      `Servicio ${serviceData.id} tomado por ${userName} con ${selectedTime} minutos`,
      'ServiceActionHandler'
    );

    // Actualizar el mensaje original manteniendo la URL
    const vehicleInfo =
      serviceData.messages && serviceData.messages.length > 1
        ? serviceData.messages[1]
        : 'No hay información del vehículo';

    const updatedMessage =
      '🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n🚨 *Nuevo Servicio Disponible*\n\n' +
      `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
      (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
      `⚠️⚡⚠️ SERVICIO TOMADO POR ${userName} CON **${selectedTime}** MINUTOS ⚠️⚡⚠️`;

    try {
      await bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: [] } // Eliminar botones
      });

      this.logger.info(
        `Mensaje actualizado para servicio ${serviceData.id}`,
        'ServiceActionHandler'
      );
    } catch (error) {
      this.logger.logError('Error al actualizar mensaje', error, 'ServiceActionHandler');
      // Continuar a pesar del error para entregar los datos
    }

    // Enviar confirmación mejorada con estilo llamativo
    const confirmationMessage =
      `🟡🟡🟡 *¡CONFIRMACIÓN DE SERVICIO!* 🟡🟡🟡

` +
      `⚡ *${userName} CONFIRMA TOMAR EL SERVICIO* ⚡

` +
      `🟡 *TIEMPO SELECCIONADO: ${selectedTime} MINUTOS* 🟡

` +
      `🟡 *${userName} SUGIERE TOMAR CON ${selectedTime} MINUTOS* 🟡

` +
      `🟡 *${userName} CONFIRMA TOMAR CON ${selectedTime} MINUTOS* 🟡

` +
      `🚗 *Vehículo:* ${vehicleInfo}`;

    queue.enqueue(
      chatId,
      async () => await bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'Markdown' }),
      `Confirmación de servicio con ${selectedTime} minutos`,
      { groupId: `confirmation_${Date.now()}_${chatId}` }
    );

    // Enviar todos los datos completos
    const detailsGroupId = `details_${Date.now()}_${chatId}`;

    this.logger.info(
      `Preparando envío de detalles completos (grupo ${detailsGroupId})`,
      'ServiceActionHandler'
    );

    // 1. Enviar rayo, número, rayo como mensajes separados PRIMERO
    queue.enqueue(chatId, async () => await bot.sendMessage(chatId, '⚡'), 'Primer rayo', {
      groupId: detailsGroupId
    });

    queue.enqueue(
      chatId,
      async () =>
        await bot.sendMessage(chatId, `*T O M A R   C O N   ${selectedTime}*`, {
          parse_mode: 'Markdown'
        }),
      'Mensaje TOMAR CON número en negritas',
      { groupId: detailsGroupId }
    );

    queue.enqueue(chatId, async () => await bot.sendMessage(chatId, '⚡'), 'Segundo rayo', {
      groupId: detailsGroupId
    });

    // 2. Enviar coordenadas DESPUÉS
    if (serviceData.coordinates && serviceData.coordinates.length > 0) {
      this.logger.info(
        `Encolando ${serviceData.coordinates.length} coordenadas para envío (DESPUÉS)`,
        'ServiceActionHandler'
      );

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
      this.logger.info(
        `Encolando ${serviceData.messages.length} mensajes para envío (DESPUÉS)`,
        'ServiceActionHandler'
      );

      // Enviar cada uno de los mensajes directamente
      for (let i = 0; i < serviceData.messages.length; i++) {
        const message = serviceData.messages[i];
        queue.enqueue(
          chatId,
          async () => await bot.sendMessage(chatId, message),
          `Dato ${i + 1}: ${message.substr(0, 20)}${message.length > 20 ? '...' : ''}`,
          { groupId: detailsGroupId }
        );
      }
    }

    // 3. Mensaje de confirmación final
    queue.enqueue(
      chatId,
      async () =>
        await bot.sendMessage(
          chatId,
          '✅🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n*Todos los datos han sido enviados correctamente.*',
          { parse_mode: 'Markdown' }
        ),
      'Confirmación final',
      { groupId: detailsGroupId }
    );

    // Completar el grupo con prioridad alta
    queue.completeGroup(detailsGroupId, chatId, true);
    this.logger.info(
      `Grupo de detalles ${detailsGroupId} completado y encolado para envío`,
      'ServiceActionHandler'
    );
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

    this.logger.info(
      `Servicio ${serviceData.id} rechazado por ${userName}`,
      'ServiceActionHandler'
    );

    // Actualizar el mensaje original manteniendo la URL
    const vehicleInfo =
      serviceData.messages && serviceData.messages.length > 1
        ? serviceData.messages[1]
        : 'No hay información del vehículo';

    const updatedMessage =
      '🅰️🅱️🅰️⭕️🅰️🅱️🅰️⭕️🅰️🅱️🅰️\n🚨 *Nuevo Servicio Disponible*\n\n' +
      `🚗 *Vehículo:* ${vehicleInfo}\n\n` +
      (serviceData.url ? `🗺️ [Ver en Google Maps](${serviceData.url})\n\n` : '') +
      `❌ *SERVICIO RECHAZADO POR ${userName}*\n\n⚠️ *Este servicio ha sido rechazado y no será procesado.*`;

    try {
      await bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: [] } // Eliminar botones
      });

      this.logger.info(
        `Mensaje actualizado para servicio rechazado ${serviceData.id}`,
        'ServiceActionHandler'
      );
    } catch (error) {
      this.logger.logError('Error al actualizar mensaje de rechazo', error, 'ServiceActionHandler');
    }

    // Eliminar servicio de la caché
    serviceCache.removeService(serviceData.id);
    this.logger.info(`Servicio ${serviceData.id} eliminado de caché`, 'ServiceActionHandler');
  }
}

module.exports = ServiceActionHandler;
