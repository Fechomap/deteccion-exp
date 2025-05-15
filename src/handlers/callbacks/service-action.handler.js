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
    
    // Verificar si es una acción de servicio
    if (callbackData.startsWith('take_service:') || callbackData.startsWith('reject_service:')) {
      const action = callbackData.split(':')[0];
      const serviceId = callbackData.split(':')[1];
      
      const serviceCache = this.services.serviceCache;
      
      // Verificar si serviceCache está disponible
      if (!serviceCache) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Servicio no disponible. Contacta al administrador.',
          show_alert: true
        });
        return;
      }
      
      const serviceData = serviceCache.getService(serviceId);
      
      if (!serviceData) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Este servicio ya no está disponible.',
          show_alert: true
        });
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
    
    // Actualizar el mensaje original
    const updatedMessage = `${query.message.text}\n\n✅ *SERVICIO TOMADO POR ${userName}*`;
    
    await bot.editMessageText(updatedMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
      reply_markup: JSON.stringify({
        inline_keyboard: []  // Eliminar botones
      })
    });
    
    // Enviar todos los datos completos
    const detailsGroupId = `details_${Date.now()}_${chatId}`;
    
    // 1. Enviar datos de ChatGPT
    if (serviceData.messages && serviceData.messages.length > 0) {
      for (let i = 0; i < serviceData.messages.length; i++) {
        const message = serviceData.messages[i];
        queue.enqueue(
          chatId,
          async () => await bot.sendMessage(chatId, message),
          `Dato ${i+1}: ${message.substr(0, 30)}${message.length > 30 ? '...' : ''}`,
          { groupId: detailsGroupId }
        );
      }
    }
    
    // 2. Enviar coordenadas
    if (serviceData.coordinates && serviceData.coordinates.length > 0) {
      for (const coord of serviceData.coordinates) {
        queue.enqueue(
          chatId,
          async () => await bot.sendMessage(chatId, coord),
          `Coordenada: ${coord}`,
          { groupId: detailsGroupId }
        );
      }
    }
    
    // Completar el grupo
    queue.completeGroup(detailsGroupId, chatId, true);
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
    
    // Actualizar el mensaje original
    const updatedMessage = `${query.message.text}\n\n❌ *SERVICIO RECHAZADO POR ${userName}*\n\n⚠️ *Este servicio ha sido rechazado y no será procesado.*`;
    
    await bot.editMessageText(updatedMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
      reply_markup: JSON.stringify({
        inline_keyboard: []  // Eliminar botones
      })
    });
    
    // Eliminar servicio de la caché
    serviceCache.removeService(serviceData.id);
  }
}

module.exports = ServiceActionHandler;