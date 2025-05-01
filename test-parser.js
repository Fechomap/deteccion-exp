// Script para probar el parser de texto con los ejemplos proporcionados
const { parseServiceText, formatDataToMessages } = require('./textParser');
const fs = require('fs');
const path = require('path');

// Ejemplos proporcionados
const examples = [
  // Ejemplo 1
  `Bienvenido GRUAS CRK - LOS REYES LA PAZ (TROYA03)
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
**©Protec** 2022 - Todos los derechos reservados.`,

  // Ejemplo 2
  `Bienvenido GRUAS CRK - LOS REYES LA PAZ (TROYA03)
** Nuevos**
** Aceptados**
 Atendidos
** Descartados**
** Avisos **
**977041 GRUAS**
OrígenDestino**Estado**DISTRITO FEDERAL**Estado**DISTRITO FEDERAL**Municipio**BENITO JUAREZ**Municipio**CUAUHTEMOC**Colonia**Niños Heroes de Chapultepec**Colonia**Dr. Neva 48, Doctores, Cuauhtémoc, 06720 Ciudad de México, CDMX//19.40894775084722, -99.14647808236938// SOBRE Doctor Neva ENTRE DR. BARRAGAN Y DR. ALVEAR NUÑEZ**Calle**Castilla**Calle**Doctor Neva**Numero ExteriorNumero Exterior**
**Referencia**Ciudad de México, Niños Héroes, 400-378**Observaciones**¿Es Equipo Pesado? No ¿Donde está varado? Vía Pública ¿Qué tiempo lleva varado? 12 HORAS ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Automático ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? SR.SALAZAR ¿Que tipo de identificación proporciona? MENCIONA NO CONTAR CON IDENTIFICACIONES SOLO LAS LLAVES DEL CARRO ¿Viaja con algún acompañante? No
Datos ServicioDatos Vehículo**Servicio**GRUAS**Marca**Dodge**Km**kms.**Modelo**JOURNEY**Costo**$580.00**Año**2018**Cargo al cliente**$0.00**Color**Gris**Costo Servicio Muerto**$250.00
Datos Cliente**Cliente**BRANDON ZAMORA ORTEGA**Compañia**Asistencia en Viaje**Referencia**JOURNEY SXT 7 PAS AUT**Observaciones**¿Es Equipo Pesado? No ¿Donde está varado? Vía Pública ¿Qué tiempo lleva varado? 12 HORAS ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Automático ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? SR.SALAZAR ¿Que tipo de identificación proporciona? MENCIONA NO CONTAR CON IDENTIFICACIONES SOLO LAS LLAVES DEL CARRO ¿Viaja con algún acompañante? No
**Version** 5.3.2
**©Protec** 2022 - Todos los derechos reservados.`,

  // Ejemplo 3
  `Bienvenido GRUAS CRK - LOS REYES LA PAZ (TROYA03)
** Nuevos**
** Aceptados**
 Atendidos
** Descartados**
** Avisos **
**977052 GRUAS**
OrígenDestino**Estado**DISTRITO FEDERAL**Estado**DISTRITO FEDERAL**Municipio**VENUSTIANO CARRANZA**Municipio**IZTACALCO**Colonia**CW95+G8 Mexico City, CDMX, Mexico//19.41882780202076, -99.0916738601119// Asistencia Pública 682, Federal, Venustiano Carranza, 15700 Ciudad de México, CDMX**Colonia**Viaducto Río de la Piedad, Santa Anita, 08300 Ciudad de México, CDMX, Mexico//19.404007797189855, -99.1249300576863// en dodge autokasa**Calle**Asistencia Pública**Calle**Viaducto Río de la Piedad**Numero ExteriorNumero Exterior**
**Referencia**Mexico City, Federal, 706(708**Observaciones**¿Es Equipo Pesado? No ¿Donde está varado? Vía Pública ¿Qué tiempo lleva varado? 1 dia ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Estándar ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? sr cruz ¿Que tipo de identificación proporciona? INE ¿Viaja con algún acompañante? No Servicio: GRUA/ MECANICA #: 5537278422 5534932988 @: no@no.com I/V: 9/May/2024
Datos ServicioDatos Vehículo**Servicio**GRUAS**Marca**Dodge**Km**kms.**Modelo**VAN**Costo**$580.00**Año**2024**Cargo al cliente**$0.00**Color**Blanco**Costo Servicio Muerto**$250.00
Datos Cliente**Cliente**GUADALUPE barrios **Compañia**Asistencia en Viaje**Referencia**RAPID PROMASTER 1.4 MT AA**Observaciones**¿Es Equipo Pesado? No ¿Donde está varado? Vía Pública ¿Qué tiempo lleva varado? 1 dia ¿Alrededor de su VH hay espacio suficiente para que la grúa pueda maniobrar? Si ¿Las 4 llantas giran correctamente y sobre su propio eje? Si ¿Se puede poner en neutral? Si ¿Es automático o estándar? Estándar ¿Tiene alguna modificación? No ¿Quién recibe y acompaña el servicio? sr cruz ¿Que tipo de identificación proporciona? INE ¿Viaja con algún acompañante? No Servicio: GRUA/ MECANICA #: 5537278422 5534932988 @: no@no.com I/V: 9/May/2024
**Version** 5.3.2
**©Protec** 2022 - Todos los derechos reservados.`
];

console.log("Iniciando pruebas del parser de texto...\n");

// Probar cada ejemplo
examples.forEach((example, index) => {
  console.log(`\n==== ANALIZANDO EJEMPLO ${index + 1} ====\n`);
  
  try {
    // Procesar el texto
    const extractedData = parseServiceText(example);
    console.log("Datos extraídos:", JSON.stringify(extractedData, null, 2));
    
    // Formatear los datos para enviar
    const messages = formatDataToMessages(extractedData);
    console.log("\nMensajes generados:");
    messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}`);
    });
    
    console.log("\n✅ Procesamiento exitoso");
  } catch (error) {
    console.error("\n❌ Error al procesar el ejemplo:", error);
  }
});

console.log("\nTodas las pruebas completadas.");