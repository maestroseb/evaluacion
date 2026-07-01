/**
 * Evaluaciones: una clase aplicada a un área concreta (clase + área).
 *
 * El curso lo aporta la clase; el área la fija la evaluación. Las unidades,
 * actividades e ítems (Fase 3) colgarán de la evaluación (evalId).
 */

/** Criterios de un área+curso, para mostrarlos al crear/abrir una evaluación. */
function getCriterios(curso, area) {
  return Curriculo.criteriosDe(curso, area);
}

/** Lista las evaluaciones con datos de su clase (nombre, curso, nº alumnos). */
function listarEvaluaciones() {
  return Evaluaciones.listar_(abrirCuaderno_());
}

/** Crea una evaluación. payload: {claseId, area} */
function crearEvaluacion(payload) {
  return Evaluaciones.crear_(abrirCuaderno_(), payload);
}

/** Evaluación completa, incluida la clase y su alumnado. */
function obtenerEvaluacion(evalId) {
  return Evaluaciones.obtener_(abrirCuaderno_(), evalId);
}

function eliminarEvaluacion(evalId) {
  return Evaluaciones.eliminar_(abrirCuaderno_(), evalId);
}


var Evaluaciones = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.EVALUACIONES); }

  function listar_(ss) {
    var sh = hoja_(ss);
    var datos = sh.getDataRange().getValues();
    var clases = indexarClases_(ss);
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      var cl = clases[f[1]] || {};
      out.push({
        evalId: f[0], claseId: f[1], area: f[2], creado: f[3],
        color: f[4] || '', icono: f[5] || '',
        claseNombre: cl.nombre || '(grupo eliminado)',
        curso: cl.curso || '',
        numAlumnos: cl.numAlumnos || 0
      });
    }
    return out;
  }

  function crear_(ss, payload) {
    if (!payload || !payload.claseId) throw new Error('Falta la clase.');
    if (!payload.area) throw new Error('Falta el área.');
    var clase = Clases.obtener_(ss, payload.claseId); // valida que existe
    var evalId = Datos.nuevoId_('e');
    hoja_(ss).appendRow([evalId, clase.claseId, payload.area,
      new Date().toISOString(), payload.color || '', payload.icono || '']);
    return obtener_(ss, evalId);
  }

  function obtener_(ss, evalId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) throw new Error('Evaluación no encontrada.');
    var f = sh.getRange(fila, 1, 1, 6).getValues()[0];
    var clase = Clases.obtener_(ss, f[1]);
    return {
      evalId: f[0], area: f[2], creado: f[3], color: f[4] || '', icono: f[5] || '',
      clase: clase, curso: clase.curso
    };
  }

  function eliminar_(ss, evalId) {
    Papelera.papelearClase_(ss, evalId); // a la papelera antes de borrar
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) throw new Error('Evaluación no encontrada.');
    sh.deleteRow(fila);
    return { ok: true };
  }

  /** ¿Alguna evaluación usa esta clase? (para impedir borrar la clase) */
  function usaClase_(ss, claseId) {
    var datos = hoja_(ss).getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) if (datos[i][1] === claseId) return true;
    return false;
  }

  function indexarClases_(ss) {
    var idx = {};
    Clases.listar_(ss).forEach(function (c) { idx[c.claseId] = c; });
    return idx;
  }

  return {
    listar_: listar_, crear_: crear_, obtener_: obtener_,
    eliminar_: eliminar_, usaClase_: usaClase_
  };
})();
