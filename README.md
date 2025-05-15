# Telegram Service Bot

Bot de Telegram especializado en la extracción de información de servicios de grúas, procesamiento de texto mediante ChatGPT y gestión de coordenadas de Google Maps.

## 📑 Descripción

Este bot está diseñado para facilitar el trabajo de operadores de servicios de grúas, permitiendo extraer rápidamente información clave de textos copiados del sistema web y coordenadas de Google Maps. Integra funcionalidades avanzadas como análisis de texto mediante ChatGPT y cálculo de tiempos de llegada a través de la API RecLocation.

## ✨ Características principales

- **Extracción de coordenadas**: Obtiene automáticamente coordenadas de enlaces de Google Maps
- **Procesamiento de texto con ChatGPT**: Analiza textos largos y extrae información clave sobre servicios
- **Integración con RecLocation**: Calcula tiempos estimados de llegada a las coordenadas extraídas
- **Operación en grupos**: Funciona tanto en chats privados como en grupos de Telegram
- **Soporte para webhook y polling**: Adaptable a entornos de desarrollo y producción

## 🛠️ Tecnologías utilizadas

- Node.js
- ChatGPT (OpenAI API)
- Telegram Bot API
- Express.js (para modo webhook)
- Axios (para peticiones HTTP)
- dotenv (para variables de entorno)

## 📂 Estructura del proyecto

```
telegram-service-bot/
├── index.js                  # Punto de entrada principal
├── bot-telegram.js           # Lógica principal del bot de Telegram
├── coordinatesExtractor.js   # Módulo para extraer coordenadas de URLs
├── textParserGPT.js          # Módulo para analizar texto con ChatGPT
├── test-parser.js            # Script para pruebas del parser
├── package.json              # Configuración del proyecto
├── .gitignore                # Archivos ignorados por git
└── logs/                     # Directorio para logs (creado automáticamente)
```

## 📋 Requisitos previos

- Node.js 14.0.0 o superior
- Cuenta de Telegram
- Token de Bot de Telegram (obtenido a través de @BotFather)
- Clave API de OpenAI
- Token de API de RecLocation (opcional)

## 🚀 Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/telegram-service-bot.git
   cd telegram-service-bot
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` con las variables necesarias:
   ```
   TELEGRAM_TOKEN=tu_token_de_telegram
   OPENAI_API_KEY=tu_api_key_de_openai
   TELEGRAM_GROUP_ID=tu_id_de_grupo_para_notificaciones
   RECLOCATION_API_TOKEN=tu_token_de_reclocation
   RECLOCATION_GROUP_ID=tu_id_de_grupo_para_reclocation
   
   # Configuración opcional para modo webhook
   USE_WEBHOOK=false
   APP_URL=https://tu-dominio.com
   PORT=3000
   ```

## 💻 Uso

### Iniciar el bot

Para modo desarrollo (polling):
```bash
npm run dev
```

Para producción:
```bash
npm start
```

### Comandos disponibles en Telegram

- `/start` - Inicia el bot y muestra información básica
- `/ayuda` - Muestra instrucciones detalladas de uso
- `/chatid` - Obtiene el ID del chat actual (útil para configuración)
- `/testtiming [coordenadas]` - Prueba la integración con RecLocation API

### Funcionalidades para usuarios

1. **Extracción de coordenadas**:
   - Envía un enlace de Google Maps al bot
   - El bot extraerá las coordenadas automáticamente
   - Solicitará tiempos de llegada a RecLocation si está configurado

2. **Procesamiento de texto**:
   - Copia el texto completo de la página del servicio (Ctrl+A, Ctrl+C)
   - Pega el texto en el chat del bot (Ctrl+V)
   - El bot usará ChatGPT para extraer:
     - Número de expediente
     - Datos del vehículo
     - Placas
     - Usuario/Cliente
     - Cuenta (siempre CHUBB)
     - Entre calles (si está disponible)
     - Referencia (si está disponible)

## ⚙️ Configuración avanzada

### Variables de entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `TELEGRAM_TOKEN` | Token del bot de Telegram | Sí |
| `OPENAI_API_KEY` | Clave API de OpenAI | Sí |
| `TELEGRAM_GROUP_ID` | ID del grupo para notificaciones | No |
| `RECLOCATION_API_URL` | URL de la API de RecLocation | No (por defecto: https://web-production-23d41.up.railway.app/api/timing) |
| `RECLOCATION_API_TOKEN` | Token para RecLocation API | No (por defecto: token_1000_anios_jehova) |
| `RECLOCATION_GROUP_ID` | ID de grupo específico para RecLocation | No (por defecto: -1002420951714) |
| `USE_WEBHOOK` | Usar modo webhook (true/false) | No (por defecto: false) |
| `APP_URL` | URL para configuración de webhook | Solo si USE_WEBHOOK=true |
| `PORT` | Puerto para el servidor webhook | No (por defecto: 3000) |
| `NODE_ENV` | Entorno de ejecución | No (por defecto: development) |

### Modos de operación

El bot puede funcionar en dos modos:

1. **Polling** (recomendado para desarrollo):
   - Configuración simple, no requiere URL pública
   - Consumo constante de recursos
   - Activar con `USE_WEBHOOK=false`

2. **Webhook** (recomendado para producción):
   - Requiere una URL pública accesible (con HTTPS)
   - Más eficiente en cuanto a recursos
   - Activar con `USE_WEBHOOK=true` y configurar `APP_URL`

## 📊 Logs

El bot genera logs detallados en la carpeta `logs/`:
- `bot_YYYY-MM-DD.log` - Actividad del bot
- `parser_YYYY-MM-DD.log` - Actividad del parser de texto

## 📄 Licencia

[ISC License](https://opensource.org/licenses/ISC)

---

Desarrollado con ❤️ para facilitar la gestión de servicios de grúas.