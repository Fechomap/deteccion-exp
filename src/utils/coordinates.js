/**
 * Utilidad para extraer coordenadas de URLs de Google Maps
 */

/**
 * Extrae coordenadas de texto que contiene URLs de Google Maps
 * @param {string} text - Texto que puede contener URLs de Google Maps
 * @returns {string[]} - Array de coordenadas encontradas
 */
function extractCoordinates(text) {
  const results = [];

  // Función auxiliar para validar coordenadas
  const validateCoord = (lat, lng) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) return false;
    if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return false;

    return { lat, lng };
  };

  // 1. Formato dir/ con parámetros adicionales (más común en .mx)
  const dirComplexPattern = /maps\/dir\/(-?\d+\.\d+),(-?\d+\.\d+)\/(-?\d+\.\d+),(-?\d+\.\d+)/;
  const dirMatch = text.match(dirComplexPattern);
  if (dirMatch) {
    const origin = validateCoord(dirMatch[1], dirMatch[2]);
    const dest = validateCoord(dirMatch[3], dirMatch[4]);

    if (origin) results.push(`${origin.lat},${origin.lng}`);
    if (dest) results.push(`${dest.lat},${dest.lng}`);

    if (results.length > 0) return results;
  }

  // 2. Formato saddr/daddr
  const saddrPattern = /saddr=(-?\d+\.\d+),(-?\d+\.\d+)&daddr=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const saddrMatch = text.match(saddrPattern);
  if (saddrMatch) {
    const origin = validateCoord(saddrMatch[1], saddrMatch[2]);
    const dest = validateCoord(saddrMatch[3], saddrMatch[4]);

    if (origin) results.push(`${origin.lat},${origin.lng}`);
    if (dest) results.push(`${dest.lat},${dest.lng}`);

    if (results.length > 0) return results;
  }

  // 3. Búsqueda general de coordenadas en el texto
  const generalPattern = /(-?\d+\.\d+),(-?\d+\.\d+)/g;
  let match;

  while ((match = generalPattern.exec(text)) !== null) {
    const coord = validateCoord(match[1], match[2]);
    if (coord) {
      // Verificar que no sea un duplicado
      const coordStr = `${coord.lat},${coord.lng}`;
      if (!results.includes(coordStr)) {
        results.push(coordStr);
      }
    }
  }

  return results;
}

module.exports = { extractCoordinates };
