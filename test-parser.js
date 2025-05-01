// Script para probar el parser de texto con ChatGPT
require('dotenv').config();
const { parseServiceText, formatDataToMessages } = require('./textParserGPT');

// Verificar OPENAI_API_KEY
if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: No se encontró OPENAI_API_KEY en el archivo .env");
  console.log("Por favor, crea un archivo .env con tu API key de OpenAI:");
  console.log("OPENAI_API_KEY=tu_api_key_aqui");
  process.exit(1);
}

// Ejemplo de texto a procesar
const exampleText = `Bienvenido GRUAS CRK - LOS REYES LA PAZ (TROYA03)
** Nuevos**
** Aceptados**
 Atendidos
** Descartados**
** Avisos **
**976076 GRUAS**
OrígenDestino**Estado**DISTRITO FEDERAL**Estado**DISTRITO FEDERAL**Municipio**MIGUEL HIDALGO**Municipio**IZTACALCO**Colonia**Polanco**Colonia**?DESTINO: Aguamiel 14, INFONAVIT Iztacalco, Iztacalco, 08900 Ciudad de México, CDMX ||| ENTRE CHICALOTE Y AGUAMIEL ||| 19.38601, -99.10661**Calle**Campos Elíseos**Calle**Aguamiel**Numero ExteriorNumero Exterior**
**Referencia**Ciudad de México, Bosque de Chapultepec I Sección, 1**Observaciones**|?| vh: JEEP PATRIOT LIMITED 4X2 Q C AUT 05 OCUP 2012 |?| ¿Es Equipo Pesado? No ¿Donde está varado? Estacionamiento, ¿Aire Libre? No, ¿Nivel? SOTANO 7 , ¿Limitante de altura para el ingreso? 2 METROS ¿Qué tiempo lleva varado? 6 HORAS ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Automático ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? SRTA. GUILLON ¿Que tipo de identificación proporciona? INE ¿Viaja con algún acompañante? No
Datos ServicioDatos Vehículo**Servicio**GRUAS**Marca**JEEP**Km**kms.**Modelo**PATRIOT**Costo**$1,665.98**Año**2012**Cargo al cliente**$0.00**Color**Negro**Costo Servicio Muerto**$250.00
Datos Cliente**Cliente**CRISTIANA ALEJANDRA GUILLON CIRIS **Compañia**Asistencia en Viaje**Referencia**JEEP PATRIOT LIMITED 4X2 Q C AUT 05 OCUP**Observaciones**|?| vh: JEEP PATRIOT LIMITED 4X2 Q C AUT 05 OCUP 2012 |?| ¿Es Equipo Pesado? No ¿Donde está varado? Estacionamiento, ¿Aire Libre? No, ¿Nivel? SOTANO 7 , ¿Limitante de altura para el ingreso? 2 METROS ¿Qué tiempo lleva varado? 6 HORAS ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Automático ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? SRTA. GUILLON ¿Que tipo de identificación proporciona? INE ¿Viaja con algún acompañante? No
**Version** 5.3.2
**©Protec** 2022 - Todos los derechos reservados.`;

console.log("===== PROBANDO PARSER CON CHATGPT =====");
console.log("Enviando texto a ChatGPT para procesamiento...");

// Ejecutar el parser con ChatGPT
parseServiceText(exampleText)
  .then(extractedData => {
    console.log("\n✅ DATOS EXTRAÍDOS POR CHATGPT:");
    console.log(JSON.stringify(extractedData, null, 2));
    
    // Formatear los datos para enviar
    const messages = formatDataToMessages(extractedData);
    
    console.log("\n✅ MENSAJES QUE SE ENVIARÍAN AL USUARIO:");
    messages.forEach((msg, i) => {
      console.log(`${i + 1}. "${msg}"`);
    });
    
    console.log("\n✅ PRUEBA COMPLETADA CON ÉXITO");
  })
  .catch(error => {
    console.error("\n❌ ERROR AL PROCESAR CON CHATGPT:", error);
  });