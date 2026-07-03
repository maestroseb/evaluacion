/**
 * Unidades de una evaluación. Cada unidad agrupa varias actividades.
 */

function crearUnidad(evalId, nombre) {
  return Unidades.crear_(abrirCuaderno_(), evalId, nombre);
}

function renombrarUnidad(unidadId, nombre) {
  return Unidades.renombrar_(abrirCuaderno_(), unidadId, nombre);
}

function eliminarUnidad(unidadId) {
  return Unidades.eliminar_(abrirCuaderno_(), unidadId);
}

/** Reordena las unidades de una evaluación según la lista de ids dada. */
function reordenarUnidades(evalId, idsOrdenados) {
  return Unidades.reordenar_(abrirCuaderno_(), evalId, idsOrdenados);
}

/** Clona una unidad con sus actividades (sin notas). Devuelve la nueva unidad. */
function clonarUnidad(unidadId) {
  return Unidades.clonar_(abrirCuaderno_(), unidadId);
}


var Unidades = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.UNIDADES); }

  function listar_(ss, evalId) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (f[0] && f[1] === evalId) {
        out.push({ unidadId: f[0], evalId: f[1], nombre: f[2], orden: f[3] });
      }
    }
    out.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    return out;
  }

  function crear_(ss, evalId, nombre, ordenDado) {
    if (!evalId) throw new Error('Falta la evaluación.');
    if (!nombre || !nombre.trim()) throw new Error('Falta el nombre de la unidad.');
    var unidadId = Datos.nuevoId_('u');
    // ordenDado evita releer la hoja en bucles (clonar / promocionar): O(n) en vez de O(n²).
    var orden = ordenDado != null ? ordenDado : Datos.siguienteOrden_(listar_(ss, evalId));
    hoja_(ss).appendRow([unidadId, evalId, nombre.trim(), orden]);
    return { unidadId: unidadId, evalId: evalId, nombre: nombre.trim(), orden: orden };
  }

  function renombrar_(ss, unidadId, nombre) {
    if (!nombre || !nombre.trim()) throw new Error('Falta el nombre de la unidad.');
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila < 0) throw new Error('Unidad no encontrada.');
    sh.getRange(fila, 3).setValue(nombre.trim());
    return { ok: true };
  }

  function eliminar_(ss, unidadId) {
    Papelera.papelearUnidad_(ss, unidadId); // foto: unidad + actividades + notas
    // Borra en cascada las actividades (una sola pasada; sin tocar el blob: la
    // unidad elimina su fila de _notas entera más abajo).
    Actividades.borrarDeUnidad_(ss, unidadId);
    Notas.borrar_(ss, unidadId); // elimina la fila de _notas de la unidad
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila < 0) throw new Error('Unidad no encontrada.');
    sh.deleteRow(fila);
    return { ok: true };
  }

  function clonar_(ss, unidadId) {
    var orig = obtener_(ss, unidadId);
    if (!orig) throw new Error('Unidad no encontrada.');
    var nueva = crear_(ss, orig.evalId, orig.nombre + ' (copia)');
    // Copia las actividades (sin ítems). La unidad nueva está vacía, así que el
    // orden es el índice de cada actividad (evita releer la hoja en cada crear_).
    Actividades.listar_(ss, unidadId).forEach(function (a, idx) {
      Actividades.crear_(ss, nueva.unidadId, {
        nombre: a.nombre, criterios: a.criterios, numItems: a.numItems, tipo: a.tipo
      }, false, idx + 1);
    });
    return nueva;
  }

  /** Reescribe la columna 'orden' (col 4) según la posición de cada id, en una escritura. */
  function reordenar_(ss, evalId, ids) {
    if (!ids || !ids.length) return { ok: true };
    var sh = hoja_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return { ok: true };
    var idCol = sh.getRange(2, 1, n, 1).getValues();
    var ordenCol = sh.getRange(2, 4, n, 1).getValues();
    var pos = {};
    ids.forEach(function (id, idx) { pos[id] = idx + 1; });
    for (var i = 0; i < n; i++) {
      var id = idCol[i][0];
      if (id && pos[id] != null) ordenCol[i][0] = pos[id];
    }
    sh.getRange(2, 4, n, 1).setValues(ordenCol);
    return { ok: true };
  }

  /** Devuelve {unidadId, evalId, nombre} o null. */
  function obtener_(ss, unidadId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila < 0) return null;
    var f = sh.getRange(fila, 1, 1, 4).getValues()[0];
    return { unidadId: f[0], evalId: f[1], nombre: f[2], orden: f[3] };
  }

  return {
    listar_: listar_, crear_: crear_, renombrar_: renombrar_,
    eliminar_: eliminar_, obtener_: obtener_, clonar_: clonar_, reordenar_: reordenar_
  };
})();
