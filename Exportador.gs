/**
 * Generador del mapa curricular A PARTIR de la hoja central completa.
 *
 * Apps Script sí lee la hoja entera (sin truncar), así que esta es la forma
 * fiable de regenerar data/mapa-curricular.json cuando amplías el mapa
 * (p. ej. al cargar 4º-6º de Primaria).
 *
 * USO:
 *   1. En el editor de Apps Script, selecciona "exportarMapaJson".
 *   2. Pulsa ▶ Ejecutar (autoriza permisos si los pide).
 *   3. En el registro (Ver → Registro) verás el ID de una hoja nueva
 *      ("mapa-export ...") con el mapa en columnas. Pásame ese ID.
 *
 * Usa solo SpreadsheetApp (scope ya autorizado): vuelca el mapa normalizado en
 * una hoja compacta (curso | area | competencia | codigo | texto), que es fácil
 * de leer y no se trunca.
 */
function exportarMapaJson() {
  var filas = Curriculo.desdeHoja(); // [{curso, area, competencia, codigo, texto}]

  var ss = SpreadsheetApp.create('mapa-export ' + new Date().toISOString());
  var sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, 5)
    .setValues([['curso', 'area', 'competencia', 'codigo', 'texto']]);
  if (filas.length) {
    var matriz = filas.map(function (f) {
      return [f.curso, f.area, f.competencia, f.codigo, f.texto];
    });
    sh.getRange(2, 1, matriz.length, 5).setValues(matriz);
  }

  Logger.log('Criterios exportados: ' + filas.length);
  Logger.log('Cursos: ' + JSON.stringify(cursosDistintos_(filas)));
  Logger.log('Hoja ID: ' + ss.getId());
  Logger.log('Hoja URL: ' + ss.getUrl());
  return ss.getId();
}

function cursosDistintos_(filas) {
  var vistos = {}, out = [];
  filas.forEach(function (f) {
    if (!vistos[f.curso]) { vistos[f.curso] = true; out.push(f.curso); }
  });
  return out;
}
