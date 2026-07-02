/**
 * Notas por unidad. Cada unidad guarda TODAS sus notas como un único JSON en la
 * pestaña _notas: una fila [unidadId, items] con
 *     items = { actividadId: { alumnoId: valor } }
 *
 * Ventajas frente al antiguo modelo de una fila por nota (global):
 *   - guardar/leer toca SOLO esa unidad (coste independiente del total del
 *     cuaderno) → escala con los años sin degradarse;
 *   - no se reescribe nada de otras unidades → sin riesgo de corromper todo;
 *   - escritura serializada con LockService → sin condiciones de carrera.
 */

/** Guarda TODO el bloque de notas de una unidad (con bloqueo por usuario). */
function guardarNotasUnidad(unidadId, items) {
  return Notas.guardar_(abrirCuaderno_(), unidadId, items);
}

var Notas = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.NOTAS); }

  /** Fila (1-based) de una unidad en _notas, o -1. Escanea SOLO la col de ids. */
  function fila_(sh, unidadId) {
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return -1;
    var ids = sh.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === unidadId) return i + 2;
    return -1;
  }

  function leer_(ss, unidadId) {
    var sh = hoja_(ss);
    var fila = fila_(sh, unidadId);
    if (fila < 0) return {};
    return parse_(sh.getRange(fila, 2).getValue());
  }

  /** Todos los bloques de notas indexados por unidadId (una sola lectura). */
  function todas_(ss) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = {};
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0]) out[datos[i][0]] = parse_(datos[i][1]);
    }
    return out;
  }

  function guardar_(ss, unidadId, items) {
    if (!unidadId) throw new Error('Falta la unidad.');
    var lock = LockService.getUserLock();
    try { lock.waitLock(20000); }
    catch (e) { throw new Error('No se pudieron guardar las notas (ocupado). Reintenta.'); }
    try {
      var sh = hoja_(ss);
      var json = JSON.stringify(limpiar_(items));
      var fila = fila_(sh, unidadId);
      if (fila < 0) sh.appendRow([unidadId, json]);
      else sh.getRange(fila, 2).setValue(json);
      return { ok: true };
    } finally {
      lock.releaseLock();
    }
  }

  /** Elimina la fila de una unidad (al borrar la unidad). */
  function borrar_(ss, unidadId) {
    var sh = hoja_(ss);
    var fila = fila_(sh, unidadId);
    if (fila >= 0) sh.deleteRow(fila);
  }

  /** Quita las notas de una actividad del bloque de su unidad (borrado suelto). */
  function quitarActividad_(ss, unidadId, actividadId) {
    var lock = LockService.getUserLock();
    try { lock.waitLock(20000); } catch (e) { return; }
    try {
      var sh = hoja_(ss);
      var fila = fila_(sh, unidadId);
      if (fila < 0) return;
      var items = parse_(sh.getRange(fila, 2).getValue());
      if (items[actividadId]) {
        delete items[actividadId];
        sh.getRange(fila, 2).setValue(JSON.stringify(items));
      }
    } finally {
      lock.releaseLock();
    }
  }

  /** Devuelve la fila cruda [unidadId, json] de una unidad, o null (para papelera). */
  function filaCruda_(ss, unidadId) {
    var sh = hoja_(ss);
    var fila = fila_(sh, unidadId);
    if (fila < 0) return null;
    return sh.getRange(fila, 1, 1, 2).getValues()[0];
  }

  /** Normaliza: descarta valores vacíos/no numéricos y actividades sin notas. */
  function limpiar_(items) {
    var out = {};
    Object.keys(items || {}).forEach(function (actId) {
      var m = items[actId] || {}, mm = {};
      Object.keys(m).forEach(function (alId) {
        var v = m[alId];
        if (v === '' || v == null) return;
        var n = Number(v);
        if (!isNaN(n)) mm[alId] = n;
      });
      if (Object.keys(mm).length) out[actId] = mm;
    });
    return out;
  }

  function parse_(json) {
    if (!json) return {};
    try { return JSON.parse(json) || {}; } catch (e) { return {}; }
  }

  return {
    leer_: leer_, todas_: todas_, guardar_: guardar_, borrar_: borrar_,
    quitarActividad_: quitarActividad_, filaCruda_: filaCruda_
  };
})();
