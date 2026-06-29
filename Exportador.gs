/**
 * Generador del JSON del mapa curricular A PARTIR de la hoja central completa.
 *
 * Apps Script sí lee la hoja entera (sin truncar), así que esta es la forma
 * fiable de regenerar data/mapa-curricular.json cuando amplías el mapa
 * (p. ej. al cargar 4º-6º de Primaria).
 *
 * USO:
 *   1. En el editor de Apps Script, selecciona la función "exportarMapaJson".
 *   2. Pulsa ▶ Ejecutar (autoriza permisos si los pide).
 *   3. En el registro (Ver → Registro) verás la URL de un documento creado con
 *      el JSON dentro. Ábrelo, copia su contenido y reemplaza
 *      data/mapa-curricular.json en el repositorio.
 *
 * Lee de CONFIG.MAPA_CURRICULAR_ID (la hoja), no del JSON.
 */
function exportarMapaJson() {
  var filas = Curriculo.desdeHoja(); // [{curso, area, competencia, codigo, texto}]
  var json = JSON.stringify(filas, null, 1);

  var doc = DocumentApp.create('mapa-curricular-export ' + new Date().toISOString());
  doc.getBody().setText(json);
  doc.saveAndClose();

  var url = doc.getUrl();
  Logger.log('Criterios exportados: ' + filas.length);
  Logger.log('Cursos: ' + JSON.stringify(cursosDistintos_(filas)));
  Logger.log('JSON en: ' + url);
  return url;
}

function cursosDistintos_(filas) {
  var vistos = {}, out = [];
  filas.forEach(function (f) {
    if (!vistos[f.curso]) { vistos[f.curso] = true; out.push(f.curso); }
  });
  return out;
}
