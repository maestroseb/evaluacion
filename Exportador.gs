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
 *   3. En el registro (Ver → Registro) verás la URL y el ID de un archivo
 *      .json creado en tu Drive con el mapa dentro. Pásame ese ID (o reemplaza
 *      tú mismo data/mapa-curricular.json en el repositorio con su contenido).
 *
 * Lee de CONFIG.MAPA_CURRICULAR_ID (la hoja), no del JSON. Usa DriveApp
 * (scope drive.file), así no requiere permisos adicionales.
 */
function exportarMapaJson() {
  var filas = Curriculo.desdeHoja(); // [{curso, area, competencia, codigo, texto}]
  var json = JSON.stringify(filas, null, 1);

  var archivo = DriveApp.createFile('mapa-curricular.json', json, 'application/json');

  Logger.log('Criterios exportados: ' + filas.length);
  Logger.log('Cursos: ' + JSON.stringify(cursosDistintos_(filas)));
  Logger.log('Archivo ID: ' + archivo.getId());
  Logger.log('Archivo URL: ' + archivo.getUrl());
  return archivo.getId();
}

function cursosDistintos_(filas) {
  var vistos = {}, out = [];
  filas.forEach(function (f) {
    if (!vistos[f.curso]) { vistos[f.curso] = true; out.push(f.curso); }
  });
  return out;
}
