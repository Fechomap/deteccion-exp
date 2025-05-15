/**
 * Inicialización y configuración de componentes
 */
const config = require('./config');
const Logger = require('./utils/logger');
const TelegramService = require('./services/telegram.service');
const RecLocationService = require('./services/reclocation.service');
const MessageQueueService = require('./services/queue');
const OpenAIService = require('./services/openai');
const ProcessingStateService = require('./services/processing-state.service');
const CoordinatesUtil = require('./utils/coordinates');
const CommandRegistry = require('./handlers/commands');
const MessageHandlerRegistry = require('./handlers/messages');

/**
 * Función principal que inicializa la aplicación
 */
async function main() {
  Logger.info('Configurando componentes de la aplicación...', 'Init');
  
  // Validar configuración
  if (!config.isValid) {
    Logger.error('Configuración inválida. Abortando.', 'Init');
    process.exit(1);
  }
  
  try {
    // Agrupar servicios para inyección de dependencias
    const services = {
      config,
      queue: MessageQueueService,
      openai: OpenAIService,
      recLocation: RecLocationService,
      processingState: ProcessingStateService,
      coordinatesUtil: CoordinatesUtil
    };
    
    // Inicializar registros de manejadores
    const commandRegistry = new CommandRegistry(services);
    const messageRegistry = new MessageHandlerRegistry(services);
    
    // Verificar conectividad con RecLocation API
    setTimeout(async () => {
      try {
        await RecLocationService.checkConnectivity();
      } catch (error) {
        Logger.warn(`No se pudo verificar la conectividad con RecLocation API: ${error.message}`, 'Init');
      }
    }, 1000);
    
    // Inicializar el bot de Telegram
    const bot = TelegramService.initialize();
    
    // Registrar manejadores
    commandRegistry.register(bot);
    messageRegistry.register(bot);
    
    // Log de información de configuración
    Logger.info(`Configuración de IDs de chat - Detección-Exp: ${config.TELEGRAM_GROUP_ID}, RecLocation: ${config.RECLOCATION_GROUP_ID}`, 'Init');
    Logger.info('Sistema de cola de mensajes activado para entrega ordenada de mensajes', 'Init');
    Logger.info('Componentes inicializados correctamente', 'Init');
  } catch (error) {
    Logger.logError('Error al inicializar los componentes', error, 'Init');
    process.exit(1);
  }
}

// Ejecutar función principal
main();