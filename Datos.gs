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
  _clases: ['claseId', 'nombre', 'curso', 'creado', 'alumnos', 'color', 'icono', 'orden', 'cursoAcademico', 'bajas', 'archivado'],
  _evaluaciones: ['evalId', 'claseId', 'area', 'creado', 'color', 'icono', 'nombre', 'orden', 'cursoAcademico', 'archivado', 'horario'],
  _unidades: ['unidadId', 'evalId', 'nombre', 'orden'],
  _actividades: ['actividadId', 'unidadId', 'nombre', 'criterios', 'numItems', 'orden', 'tipo', 'desglose', 'rubricaId', 'rubMap'],
  _notas: ['unidadId', 'items'],
  _papelera: ['papeleraId', 'tipo', 'etiqueta', 'fecha', 'contenido'],
  // Banco de rúbricas del profe (v12). 'indicadores' y 'niveles' son JSON; en
  // cada indicador se reserva un campo 'criterios' para la futura asociación por
  // indicador. 'criterios' (columna) = códigos asociados a la rúbrica completa.
  _rubricas: ['rubricaId', 'nombre', 'indicadores', 'niveles', 'criterios', 'creado', 'orden'],
  // Planificador de sesiones (v16). 'criterios' es JSON (códigos trabajados);
  // 'asignaciones' es JSON [{evalId, fecha, estado}]: la misma sesión puede
  // programarse en varias clases, cada una con su fecha y su estado.
  _planner: ['sesionId', 'titulo', 'descripcion', 'criterios', 'asignaciones', 'creado', 'orden', 'tipo', 'unidadId', 'paginas', 'deberes'],
  // Unidades de planificación del profe (v21), por materia/área (independientes
  // de las unidades de evaluación). Una sesión puede colgar de una.
  _planUnidades: ['unidadId', 'area', 'nombre', 'orden', 'creado', 'curso'],
  // Calendario por curso académico (v23): inicio/fin del curso y 'festivos'
  // (JSON [{desde, hasta, nombre}]). Una fila por curso académico.
  _calendario: ['cursoAcademico', 'inicio', 'fin', 'festivos'],
  // Vínculo clase↔calendario de Google (v25): una fila por clase publicada.
  _calsync: ['evalId', 'calendarId', 'creado'],
  // Clases provisionales del planificador (v18): solo un nombre y su horario,
  // para planificar antes de crear grupos/clases. 'horario' como en
  // _evaluaciones (JSON [{dia,hora}]). Al vincular a una clase real, la fila
  // desaparece (su horario y sus asignaciones pasan a la clase).
  _provisionales: ['provId', 'nombre', 'horario', 'creado']
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
    // Recién creado = esquema al día: evita la verificación completa en la
    // siguiente llamada (ver asegurarEsquema_).
    PropertiesService.getUserProperties()
      .setProperty('esquemaOk', CONFIG.ESQUEMA_VERSION + ':' + ss.getId());
  }

  /**
   * Crea las pestañas que falten y, en las existentes, añade las columnas nuevas
   * del esquema (migración no destructiva para cuadernos antiguos).
   *
   * La verificación completa cuesta ~15 accesos a la hoja, así que solo se hace
   * UNA vez por versión del esquema: al terminar se apunta en las propiedades
   * del usuario y las llamadas siguientes salen sin tocar la hoja. Al subir
   * ESQUEMA_VERSION (o cambiar de cuaderno) la marca deja de coincidir y la
   * verificación vuelve a ejecutarse.
   */
  function asegurarEsquema_(ss) {
    var props = PropertiesService.getUserProperties();
    var marca = CONFIG.ESQUEMA_VERSION + ':' + ss.getId();
    if (props.getProperty('esquemaOk') === marca) return;
    Object.keys(ESQUEMA).forEach(function (nombre) {
      var sh = ss.getSheetByName(nombre);
      if (!sh) { crearHoja_(ss, nombre, ESQUEMA[nombre]); return; }
      asegurarColumnas_(sh, ESQUEMA[nombre]);
    });
    setMeta_(ss, 'esquemaVersion', CONFIG.ESQUEMA_VERSION);
    props.setProperty('esquemaOk', marca);
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

  /**
   * Siguiente valor de 'orden' a partir de una lista de elementos con campo
   * .orden: max(orden) + 1. Robusto frente a huecos por borrados (evita
   * duplicar el orden de un elemento existente, cosa que sí pasa con length+1).
   */
  function siguienteOrden_(lista) {
    var m = 0;
    (lista || []).forEach(function (x) { var o = Number(x.orden) || 0; if (o > m) m = o; });
    return m + 1;
  }

  /**
   * Reescribe la columna de orden según la posición de cada id en la lista, en
   * UNA sola escritura. Compartida por todas las pestañas con reordenación
   * (clases, evaluaciones, unidades, actividades y rúbricas); solo cambia el
   * número de columna. Los ids ausentes de la lista conservan su orden.
   */
  function reordenarPorIds_(sh, colOrden, ids) {
    if (!ids || !ids.length) return { ok: true };
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return { ok: true };
    var idCol = sh.getRange(2, 1, n, 1).getValues();
    var ordenCol = sh.getRange(2, colOrden, n, 1).getValues();
    var pos = {};
    ids.forEach(function (id, idx) { pos[id] = idx + 1; });
    for (var i = 0; i < n; i++) {
      var id = idCol[i][0];
      if (id && pos[id] != null) ordenCol[i][0] = pos[id];
    }
    sh.getRange(2, colOrden, n, 1).setValues(ordenCol);
    return { ok: true };
  }

  return {
    inicializarEsquema_: inicializarEsquema_,
    asegurarEsquema_: asegurarEsquema_,
    filaDeId_: filaDeId_,
    nuevoId_: nuevoId_,
    siguienteOrden_: siguienteOrden_,
    reordenarPorIds_: reordenarPorIds_
  };
})();
