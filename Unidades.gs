/**
 * Unidades de una evaluación. Cada unidad agrupa varias actividades.
 */

function listarUnidades(evalId) {
  return Unidades.listar_(abrirCuaderno_(), evalId);
}

function crearUnidad(evalId, nombre) {
  return Unidades.crear_(abrirCuaderno_(), evalId, nombre);
}

function renombrarUnidad(unidadId, nombre) {
  return Unidades.renombrar_(abrirCuaderno_(), unidadId, nombre);
}

function eliminarUnidad(unidadId) {
  return Unidades.eliminar_(abrirCuaderno_(), unidadId);
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

  function crear_(ss, evalId, nombre) {
    if (!evalId) throw new Error('Falta la evaluación.');
    if (!nombre || !nombre.trim()) throw new Error('Falta el nombre de la unidad.');
    var unidadId = Datos.nuevoId_('u');
    var orden = listar_(ss, evalId).length + 1;
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
    // Borra en cascada las actividades de la unidad (y sus ítems).
    Actividades.listar_(ss, unidadId).forEach(function (a) {
      Actividades.eliminar_(ss, a.actividadId);
    });
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila < 0) throw new Error('Unidad no encontrada.');
    sh.deleteRow(fila);
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
    eliminar_: eliminar_, obtener_: obtener_
  };
})();
