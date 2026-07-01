/**
 * Migración del almacenamiento de notas: de _items (una fila por nota, global)
 * a _notas (un JSON por unidad). Se ejecuta UNA vez, a mano, desde el editor de
 * Apps Script.
 *
 *   migrarNotasAUnidad()   → construye _notas a partir de _items. NO borra _items
 *                            (queda como copia de seguridad congelada). Idempotente:
 *                            si ya se migró, no repite (para no pisar ediciones
 *                            posteriores). Hace una copia de seguridad antes.
 *
 *   revertirNotasAItems()  → reconstruye _items desde _notas (para ROLLBACK: si hay
 *                            que volver al código antiguo, deja _items al día).
 *
 * Rollback recomendado: revertirNotasAItems() y luego desplegar la versión previa.
 */

/** Migra _items → _notas. Devuelve un resumen legible. */
function migrarNotasAUnidad() {
  return Migracion.migrarNotas_(abrirCuaderno_(), false);
}
/** Forzar re-migración (¡pisa _notas con lo que haya en _items!). Usar con cuidado. */
function migrarNotasAUnidadForzado() {
  return Migracion.migrarNotas_(abrirCuaderno_(), true);
}
/** Reconstruye _items desde _notas (rollback). */
function revertirNotasAItems() {
  return Migracion.revertir_(abrirCuaderno_());
}

var Migracion = (function () {

  var FLAG = 'notasMigradas';

  function migrarNotas_(ss, forzar) {
    if (!forzar && getMeta_(ss, FLAG)) {
      return 'Ya estaba migrado (flag "' + FLAG + '"=' + getMeta_(ss, FLAG) +
        '). No se repite. Usa migrarNotasAUnidadForzado() si de verdad quieres rehacerlo.';
    }
    Respaldo.ahora_(ss); // copia de seguridad ANTES de nada

    // actividadId -> unidadId
    var shA = ss.getSheetByName(HOJAS.ACTIVIDADES);
    var datosA = shA.getDataRange().getValues();
    var unidadDe = {};
    for (var i = 1; i < datosA.length; i++) if (datosA[i][0]) unidadDe[datosA[i][0]] = datosA[i][1];

    // _items -> blobs por unidad: { unidadId: { actId: { alId: valor } } }
    var shI = ss.getSheetByName(HOJAS.ITEMS);
    var datosI = shI ? shI.getDataRange().getValues() : [[]];
    var blobs = {}, notas = 0, huerfanas = 0;
    for (var j = 1; j < datosI.length; j++) {
      var f = datosI[j];
      if (!f[0]) continue;
      var uId = unidadDe[f[0]];
      if (!uId) { huerfanas++; continue; } // ítem de una actividad ya inexistente
      var v = Number(f[2]);
      if (f[2] === '' || f[2] == null || isNaN(v)) continue;
      ((blobs[uId] || (blobs[uId] = {}))[f[0]] || (blobs[uId][f[0]] = {}))[f[1]] = v;
      notas++;
    }

    // Escribe _notas (una fila por unidad con datos).
    var shN = ss.getSheetByName(HOJAS.NOTAS);
    if (shN.getLastRow() > 1) shN.getRange(2, 1, shN.getLastRow() - 1, 2).clearContent();
    var filas = Object.keys(blobs).map(function (uId) { return [uId, JSON.stringify(blobs[uId])]; });
    if (filas.length) shN.getRange(2, 1, filas.length, 2).setValues(filas);

    setMeta_(ss, FLAG, CONFIG.ESQUEMA_VERSION + '@' + new Date().toISOString());
    var msg = 'Migración OK: ' + filas.length + ' unidades, ' + notas + ' notas' +
      (huerfanas ? ' (' + huerfanas + ' ítems huérfanos ignorados)' : '') +
      '. _items se conserva como copia.';
    Logger.log(msg);
    return msg;
  }

  function revertir_(ss) {
    var shN = ss.getSheetByName(HOJAS.NOTAS);
    var datosN = shN.getDataRange().getValues();
    var filas = [];
    for (var i = 1; i < datosN.length; i++) {
      var uId = datosN[i][0];
      if (!uId) continue;
      var blob = {};
      try { blob = JSON.parse(datosN[i][1]) || {}; } catch (e) {}
      Object.keys(blob).forEach(function (actId) {
        var m = blob[actId] || {};
        Object.keys(m).forEach(function (alId) { filas.push([actId, alId, m[alId]]); });
      });
    }
    var shI = ss.getSheetByName(HOJAS.ITEMS);
    if (shI.getLastRow() > 1) shI.getRange(2, 1, shI.getLastRow() - 1, 3).clearContent();
    if (filas.length) shI.getRange(2, 1, filas.length, 3).setValues(filas);
    setMeta_(ss, FLAG, ''); // quita el flag para permitir re-migrar tras el rollback
    var msg = 'Rollback OK: _items reconstruido con ' + filas.length + ' notas desde _notas.';
    Logger.log(msg);
    return msg;
  }

  /**
   * Se llama al cargar la app: migra _items → _notas UNA sola vez, de forma
   * transparente (así, al actualizar el código, las notas no "desaparecen"
   * hasta migrar a mano). Si falla, no rompe la carga: _items sigue intacto y
   * se reintentará en la siguiente carga.
   */
  function auto_(ss) {
    try { if (!getMeta_(ss, FLAG)) migrarNotas_(ss, false); }
    catch (e) { Logger.log('Auto-migración de notas falló (se reintentará): ' + e); }
  }

  // --- meta (_meta: clave/valor) ---
  function getMeta_(ss, clave) {
    var sh = ss.getSheetByName(HOJAS.META);
    var datos = sh.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) if (datos[i][0] === clave) return datos[i][1];
    return null;
  }
  function setMeta_(ss, clave, valor) {
    var sh = ss.getSheetByName(HOJAS.META);
    var datos = sh.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
    }
    sh.appendRow([clave, valor]);
  }

  return { migrarNotas_: migrarNotas_, revertir_: revertir_, auto_: auto_ };
})();
