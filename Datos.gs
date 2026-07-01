/**
 * Capa de acceso al "cuaderno" personal de cada profe.
 *
 * El cuaderno es una hoja de cálculo en el Drive del propio usuario que actúa
 * como base de datos. El profe nunca la edita a mano: toda la interacción pasa
 * por la Web App, así que es imposible "romper columnas".
 *
 * Modelo:
 *   - Clase:       lista de alumnado + curso. Se crea una vez y se reutiliza.
 *   - Evaluación:  una clase aplicada a un área concreta (clase + área).
 *   Así una misma clase ("3º A") se evalúa en varias áreas sin repetir la lista.
 */

/** Cabeceras de cada pestaña interna. */
var ESQUEMA = {
  _meta: ['clave', 'valor'],
  _clases: ['claseId', 'nombre', 'curso', 'creado', 'alumnos'],
  _evaluaciones: ['evalId', 'claseId', 'area', 'creado', 'color', 'icono', 'nombre'],
  _unidades: ['unidadId', 'evalId', 'nombre', 'orden'],
  _actividades: ['actividadId', 'unidadId', 'nombre', 'criterios', 'numItems', 'orden'],
  _items: ['actividadId', 'alumnoId', 'conseguidos'],
  _papelera: ['papeleraId', 'tipo', 'etiqueta', 'fecha', 'contenido']
};

/**
 * Abre el cuaderno del usuario actual, creándolo la primera vez y garantizando
 * que tiene todas las pestañas del esquema (para cuadernos antiguos).
 * @return {Spreadsheet}
 */
function abrirCuaderno_() {
  var props = PropertiesService.getUserProperties();
  var id = props.getProperty('cuadernoId');

  if (id) {
    try {
      var ss = SpreadsheetApp.openById(id);
      Datos.asegurarEsquema_(ss);
      return ss;
    } catch (e) {
      // No tocamos la propiedad aquí: puede ser un fallo transitorio. La
      // creación va protegida por lock más abajo para no duplicar cuadernos.
    }
  }

  // Bloqueo por usuario: evita que varias llamadas en paralelo (p. ej. al pegar)
  // creen cada una su propio cuaderno.
  var lock = LockService.getUserLock();
  try {
    lock.waitLock(25000);
  } catch (e) {
    throw new Error('No se pudo abrir tu cuaderno (bloqueo ocupado). Reintenta en un momento.');
  }
  try {
    // Reintenta dentro del lock: otra llamada pudo crearlo ya.
    id = props.getProperty('cuadernoId');
    if (id) {
      try {
        var existente = SpreadsheetApp.openById(id);
        Datos.asegurarEsquema_(existente);
        return existente;
      } catch (e2) {
        props.deleteProperty('cuadernoId'); // realmente no existe: recrear
      }
    }
    var nuevo = SpreadsheetApp.create(CONFIG.NOMBRE_CUADERNO);
    Datos.inicializarEsquema_(nuevo);
    props.setProperty('cuadernoId', nuevo.getId());
    return nuevo;
  } finally {
    lock.releaseLock();
  }
}

var Datos = (function () {

  /** Crea todas las pestañas y mete los metadatos iniciales. */
  function inicializarEsquema_(ss) {
    var defecto = ss.getSheets()[0];
    Object.keys(ESQUEMA).forEach(function (nombre) {
      crearHoja_(ss, nombre, ESQUEMA[nombre]);
    });
    setMeta_(ss, 'esquemaVersion', CONFIG.ESQUEMA_VERSION);
    setMeta_(ss, 'creado', new Date().toISOString());
    setMeta_(ss, 'dueno', Session.getActiveUser().getEmail());
    if (defecto && ESQUEMA[defecto.getName()] === undefined) ss.deleteSheet(defecto);
  }

  /**
   * Crea las pestañas que falten y, en las existentes, añade las columnas nuevas
   * del esquema (migración no destructiva para cuadernos antiguos).
   */
  function asegurarEsquema_(ss) {
    Object.keys(ESQUEMA).forEach(function (nombre) {
      var sh = ss.getSheetByName(nombre);
      if (!sh) { crearHoja_(ss, nombre, ESQUEMA[nombre]); return; }
      asegurarColumnas_(sh, ESQUEMA[nombre]);
    });
  }

  /** Añade al final las cabeceras del esquema que aún no estén en la hoja. */
  function asegurarColumnas_(sh, cabeceras) {
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);
      sh.setFrozenRows(1);
      return;
    }
    var lastCol = sh.getLastColumn();
    if (lastCol < cabeceras.length) {
      var faltan = cabeceras.slice(lastCol);
      sh.getRange(1, lastCol + 1, 1, faltan.length).setValues([faltan]);
    }
  }

  function crearHoja_(ss, nombre, cabeceras) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function setMeta_(ss, clave, valor) {
    var sh = ss.getSheetByName(HOJAS.META);
    var datos = sh.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
    }
    sh.appendRow([clave, valor]);
  }

  // --- utilidades compartidas para los módulos Clases/Evaluaciones ---

  /** Localiza la fila (1-based) cuyo id (col 1) coincide, o -1. */
  function filaDeId_(sh, id) {
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return -1;
    var ids = sh.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
    return -1;
  }

  function nuevoId_(prefijo) {
    return prefijo + '_' + Utilities.getUuid().slice(0, 8);
  }

  return {
    inicializarEsquema_: inicializarEsquema_,
    asegurarEsquema_: asegurarEsquema_,
    filaDeId_: filaDeId_,
    nuevoId_: nuevoId_
  };
})();
