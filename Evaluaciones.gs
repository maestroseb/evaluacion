/**
 * Evaluaciones: una clase aplicada a un área concreta (clase + área).
 *
 * El curso lo aporta la clase; el área la fija la evaluación. Las unidades,
 * actividades e ítems (Fase 3) colgarán de la evaluación (evalId).
 */

/** Crea una evaluación. payload: {claseId, area, color, icono, nombre} */
function crearEvaluacion(payload) {
  return Evaluaciones.crear_(abrirCuaderno_(), payload);
}

/** Edita el nombre, color e icono de una evaluación (no cambia grupo ni área). */
function editarEvaluacion(evalId, payload) {
  return Evaluaciones.editar_(abrirCuaderno_(), evalId, payload);
}

/**
 * Evaluación completa (con clase y alumnado) + sus unidades, en UNA sola
 * llamada: abrir una clase es un único viaje al servidor.
 */
function getEvaluacionCompleta(evalId) {
  var ss = abrirCuaderno_();
  var ev = Evaluaciones.obtener_(ss, evalId);
  ev.unidades = Unidades.listar_(ss, evalId);
  return ev;
}

function eliminarEvaluacion(evalId) {
  return Evaluaciones.eliminar_(abrirCuaderno_(), evalId);
}

/** Archiva (si=true) o restaura (si=false) una clase suelta: fuera de la vista, sin borrar. */
function archivarEvaluacion(evalId, si) {
  return Evaluaciones.archivar_(abrirCuaderno_(), evalId, si);
}

/** Reordena las evaluaciones (clases) según el nuevo orden de ids en la rejilla. */
function reordenarEvaluaciones(ids) {
  return Evaluaciones.reordenar_(abrirCuaderno_(), ids);
}

/**
 * Guarda el horario semanal de varias clases a la vez (lo edita el
 * planificador): {evalId: [{dia:0-6, hora:'HH:MM' opcional}]}, 0 = lunes.
 */
function guardarHorarios(mapa) {
  return Evaluaciones.guardarHorarios_(abrirCuaderno_(), mapa);
}


var Evaluaciones = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.EVALUACIONES); }

  function listar_(ss, clasesLista) {
    var sh = hoja_(ss);
    var datos = sh.getDataRange().getValues();
    var clases = indexarClases_(ss, clasesLista);
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      var cl = clases[f[1]] || {};
      out.push({
        evalId: f[0], claseId: f[1], area: f[2], creado: f[3],
        color: f[4] || '', icono: f[5] || '', nombre: f[6] || f[2], orden: Number(f[7]) || 0,
        cursoAcademico: f[8] || '',
        claseNombre: cl.nombre || '(grupo eliminado)',
        curso: cl.curso || '',
        numAlumnos: cl.numAlumnos || 0,
        // Archivada ella misma vs. oculta porque su grupo está archivado: la
        // interfaz esconde ambas, pero solo la primera se restaura suelta.
        archivado: !!f[9],
        grupoArchivado: !!cl.archivado,
        horario: parseHorario_(f[10])
      });
    }
    out.sort(function (a, b) { return a.orden - b.orden; }); // orden guardado (0 = antiguos)
    return out;
  }

  function crear_(ss, payload) {
    if (!payload || !payload.claseId) throw new Error('Falta la clase.');
    if (!payload.area) throw new Error('Falta el área.');
    var clase = Clases.obtener_(ss, payload.claseId); // valida que existe
    var evalId = Datos.nuevoId_('e');
    var nombre = (payload.nombre && String(payload.nombre).trim()) || payload.area;
    var orden = Datos.siguienteOrden_(listar_(ss));
    // La clase hereda el curso académico de su grupo (o el activo si el grupo
    // aún no lo tuviera asignado).
    var cursoAcad = clase.cursoAcademico || Cursos.activo_();
    hoja_(ss).appendRow([evalId, clase.claseId, payload.area,
      new Date().toISOString(), payload.color || '', payload.icono || '', nombre, orden, cursoAcad]);
    return obtener_(ss, evalId);
  }

  /** Reordena las evaluaciones según la lista de ids (col 8 = orden), en una escritura. */
  function reordenar_(ss, ids) {
    return Datos.reordenarPorIds_(hoja_(ss), 8, ids); // col 8 = orden
  }

  function obtener_(ss, evalId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) throw new Error('Evaluación no encontrada.');
    var f = sh.getRange(fila, 1, 1, 7).getValues()[0];
    var clase = Clases.obtener_(ss, f[1]);
    return {
      evalId: f[0], area: f[2], creado: f[3], color: f[4] || '', icono: f[5] || '',
      nombre: f[6] || f[2], clase: clase, curso: clase.curso
    };
  }

  /** Actualiza nombre, color e icono. Mantiene grupo y área intactos. */
  function editar_(ss, evalId, payload) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) throw new Error('Evaluación no encontrada.');
    var actual = sh.getRange(fila, 1, 1, 7).getValues()[0];
    var nombre = (payload.nombre != null && String(payload.nombre).trim())
      ? String(payload.nombre).trim() : actual[2]; // por defecto, el área
    // Columnas 5,6,7 = color, icono, nombre.
    sh.getRange(fila, 5, 1, 3).setValues([[payload.color || '', payload.icono || '', nombre]]);
    return obtener_(ss, evalId);
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

  /** Ids de las evaluaciones de un grupo (para la eliminación en cascada). */
  function idsDeClase_(ss, claseId) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] && datos[i][1] === claseId) out.push(datos[i][0]);
    }
    return out;
  }

  /** Marca (si=true) o desmarca la evaluación como archivada (col 10). */
  function archivar_(ss, evalId, si) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) throw new Error('Evaluación no encontrada.');
    sh.getRange(fila, 10).setValue(si ? 1 : '');
    return { ok: true };
  }

  /** Escribe el horario (col 11) de cada evalId del mapa, ya saneado. */
  function guardarHorarios_(ss, mapa) {
    var sh = hoja_(ss);
    Object.keys(mapa || {}).forEach(function (evalId) {
      var fila = Datos.filaDeId_(sh, evalId);
      if (fila < 0) return; // borrada entre abrir el modal y guardar
      sh.getRange(fila, 11).setValue(JSON.stringify(horarioValido_(mapa[evalId])));
    });
    return { ok: true };
  }

  /** Horario en forma canónica: días 0-6 sin duplicar, hora HH:MM o vacía. */
  function horarioValido_(lista) {
    var out = [], vistos = {};
    (Array.isArray(lista) ? lista : []).forEach(function (h) {
      var dia = Number(h && h.dia);
      if (!(dia >= 0 && dia <= 6) || dia % 1 !== 0 || vistos[dia]) return;
      var hora = String((h && h.hora) || '').trim();
      if (!/^\d{2}:\d{2}$/.test(hora)) hora = '';
      vistos[dia] = true;
      out.push({ dia: dia, hora: hora });
    });
    out.sort(function (a, b) { return a.dia - b.dia; });
    return out;
  }

  function parseHorario_(json) {
    if (!json) return [];
    try { var v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  function indexarClases_(ss, clasesLista) {
    var idx = {};
    (clasesLista || Clases.listar_(ss)).forEach(function (c) { idx[c.claseId] = c; });
    return idx;
  }

  return {
    listar_: listar_, crear_: crear_, obtener_: obtener_, editar_: editar_,
    eliminar_: eliminar_, usaClase_: usaClase_, idsDeClase_: idsDeClase_,
    archivar_: archivar_, reordenar_: reordenar_,
    guardarHorarios_: guardarHorarios_
  };
})();
