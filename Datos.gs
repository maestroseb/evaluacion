/**
 * Capa de acceso al "cuaderno" personal de cada profe.
 *
 * El cuaderno es una hoja de cálculo en el Drive del propio usuario que actúa
 * como base de datos. El profe nunca la edita a mano: toda la interacción pasa
 * por la Web App, así que es imposible "romper columnas".
 */

/**
 * Abre el cuaderno del usuario actual, creándolo la primera vez.
 * Guarda el ID en las propiedades del usuario para no buscarlo cada vez.
 * @return {Spreadsheet}
 */
function abrirCuaderno_() {
  var props = PropertiesService.getUserProperties();
  var id = props.getProperty('cuadernoId');

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // El usuario pudo borrar la hoja: la recreamos.
      props.deleteProperty('cuadernoId');
    }
  }

  var ss = SpreadsheetApp.create(CONFIG.NOMBRE_CUADERNO);
  Datos.inicializarEsquema_(ss);
  props.setProperty('cuadernoId', ss.getId());
  return ss;
}

var Datos = (function () {

  /** Crea las pestañas internas y sus cabeceras la primera vez. */
  function inicializarEsquema_(ss) {
    // Quita la hoja por defecto "Hoja 1" al final, una vez creadas las nuestras.
    var defecto = ss.getSheets()[0];

    crearHoja_(ss, HOJAS.META, ['clave', 'valor']);
    setMeta_(ss, 'esquemaVersion', CONFIG.ESQUEMA_VERSION);
    setMeta_(ss, 'creado', new Date().toISOString());
    setMeta_(ss, 'dueno', Session.getActiveUser().getEmail());

    crearHoja_(ss, HOJAS.GRUPOS, ['grupoId', 'nombre', 'area', 'curso', 'creado']);
    crearHoja_(ss, HOJAS.UNIDADES, ['unidadId', 'grupoId', 'nombre', 'orden']);
    crearHoja_(ss, HOJAS.ACTIVIDADES,
      ['actividadId', 'unidadId', 'nombre', 'criterios', 'numItems', 'orden']);
    // alumno se identifica por su posición en la lista del grupo (alumnoId).
    crearHoja_(ss, HOJAS.ITEMS, ['actividadId', 'alumnoId', 'conseguidos']);

    // alumnos van en _grupos como JSON en una columna ampliada.
    var hg = ss.getSheetByName(HOJAS.GRUPOS);
    hg.getRange(1, 6).setValue('alumnos'); // JSON: [{id, nombre}]

    ss.deleteSheet(defecto);
  }

  function crearHoja_(ss, nombre, cabeceras) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.clear();
    sh.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);
    sh.setFrozenRows(1);
    return sh;
  }

  function setMeta_(ss, clave, valor) {
    var sh = ss.getSheetByName(HOJAS.META);
    var datos = sh.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === clave) {
        sh.getRange(i + 1, 2).setValue(valor);
        return;
      }
    }
    sh.appendRow([clave, valor]);
  }

  /** Devuelve la lista de grupos del profe (sin el alumnado, solo cabecera). */
  function listarGrupos(ss) {
    var sh = ss.getSheetByName(HOJAS.GRUPOS);
    var datos = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      out.push({
        grupoId: f[0],
        nombre: f[1],
        area: f[2],
        curso: f[3],
        creado: f[4],
        numAlumnos: contarAlumnos_(f[5])
      });
    }
    return out;
  }

  function contarAlumnos_(json) {
    if (!json) return 0;
    try { return JSON.parse(json).length; } catch (e) { return 0; }
  }

  return {
    inicializarEsquema_: inicializarEsquema_,
    listarGrupos: listarGrupos
  };
})();
