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
    return descifrarTextos_(parse_(sh.getRange(fila, 2).getValue()));
  }

  /** Todos los bloques de notas indexados por unidadId (una sola lectura). */
  function todas_(ss) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = {};
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0]) out[datos[i][0]] = descifrarTextos_(parse_(datos[i][1]));
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
      var json = JSON.stringify(cifrarTextos_(limpiar_(items)));
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
    try { lock.waitLock(20000); }
    catch (e) { Logger.log('Notas: lock ocupado, operación pospuesta: ' + e); return; }
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

  /**
   * Vuelve a poner las notas de una actividad en el bloque de su unidad
   * (restaurar desde la papelera). Trabaja con el blob CRUDO: las observaciones
   * llegan tal como se guardaron (cifradas) y no se re-cifran ni se exponen.
   */
  function reponerActividad_(ss, unidadId, actividadId, grades) {
    var lock = LockService.getUserLock();
    try { lock.waitLock(20000); }
    catch (e) { Logger.log('Notas: lock ocupado, operación pospuesta: ' + e); return; }
    try {
      var sh = hoja_(ss);
      var fila = fila_(sh, unidadId);
      var items = fila < 0 ? {} : parse_(sh.getRange(fila, 2).getValue());
      items[actividadId] = grades || {};
      var json = JSON.stringify(items);
      if (fila < 0) sh.appendRow([unidadId, json]);
      else sh.getRange(fila, 2).setValue(json);
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

  /** Normaliza: números como número, textos (observaciones) acotados, resto fuera. */
  function limpiar_(items) {
    var out = {};
    Object.keys(items || {}).forEach(function (actId) {
      var m = items[actId] || {}, mm = {};
      Object.keys(m).forEach(function (alId) {
        var v = m[alId];
        if (v == null) return;
        // Desglose por criterio: objeto {codigo: valor numérico}.
        if (typeof v === 'object') {
          var d = {};
          Object.keys(v).forEach(function (cod) {
            if (v[cod] === '' || v[cod] == null) return;
            var nd = Number(v[cod]);
            if (!isNaN(nd)) d[String(cod).slice(0, 40)] = nd;
          });
          if (Object.keys(d).length) mm[alId] = d;
          return;
        }
        if (typeof v === 'string' && !v.trim()) return; // '' o solo espacios
        var n = Number(v);
        if (!isNaN(n)) { mm[alId] = n; return; }
        mm[alId] = String(v).trim().slice(0, 500);
      });
      if (Object.keys(mm).length) out[actId] = mm;
    });
    return out;
  }

  function parse_(json) {
    if (!json) return {};
    try { return JSON.parse(json) || {}; } catch (e) { return {}; }
  }

  /**
   * Cifrado de las observaciones: los valores de TEXTO del blob se guardan
   * cifrados (como los nombres del alumnado); los números van tal cual.
   * quitarActividad_ trabaja con el blob crudo, así que no re-escribe en claro.
   */
  function mapaTextos_(items, fn) {
    var out = {};
    Object.keys(items || {}).forEach(function (actId) {
      var m = items[actId] || {}, mm = {};
      Object.keys(m).forEach(function (alId) {
        var v = m[alId];
        mm[alId] = (typeof v === 'string') ? fn(v) : v;
      });
      out[actId] = mm;
    });
    return out;
  }
  function cifrarTextos_(items) { return mapaTextos_(items, Cripto.cifrar); }
  function descifrarTextos_(items) { return mapaTextos_(items, Cripto.descifrar); }
  /** JSON del blob con los textos en claro (para copias y traspasos). */
  function jsonEnClaro_(json) { return JSON.stringify(descifrarTextos_(parse_(json))); }

  return {
    leer_: leer_, todas_: todas_, guardar_: guardar_, borrar_: borrar_,
    quitarActividad_: quitarActividad_, reponerActividad_: reponerActividad_,
    filaCruda_: filaCruda_,
    cifrarTextos_: cifrarTextos_, descifrarTextos_: descifrarTextos_,
    jsonEnClaro_: jsonEnClaro_
  };
})();
