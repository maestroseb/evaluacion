/**
 * Actividades de una unidad, ítems conseguidos por alumno y datos de la rejilla.
 *
 * Cada actividad se asocia a uno o varios criterios y define un nº de ítems.
 * La nota de un alumno en una actividad = ítems_conseguidos / nº_ítems * 10,
 * y esa nota cuenta para cada criterio asociado. El cálculo agregado vive en
 * Resumen.gs (servidor) y, en vivo, en el cliente.
 */

/** payload: {nombre, criterios:[codigos], numItems} */
function crearActividad(unidadId, payload) {
  return Actividades.crear_(abrirCuaderno_(), unidadId, payload);
}

/** Crea varias actividades de una vez. lista: [{nombre, criterios, numItems}] */
function crearActividades(unidadId, lista) {
  var ss = abrirCuaderno_();
  // Calcula el orden base una sola vez (evita releer la hoja en cada crear_).
  var base = Datos.siguienteOrden_(Actividades.listar_(ss, unidadId));
  return (lista || []).map(function (p, i) {
    return Actividades.crear_(ss, unidadId, p, false, base + i);
  });
}

function editarActividad(actividadId, payload) {
  return Actividades.editar_(abrirCuaderno_(), actividadId, payload);
}

function eliminarActividad(actividadId) {
  return Actividades.eliminar_(abrirCuaderno_(), actividadId);
}

/** Duplica una actividad (mismos criterios y nº de ítems, sin notas). */
function duplicarActividad(actividadId) {
  return Actividades.duplicar_(abrirCuaderno_(), actividadId);
}

/** Reordena las actividades de una unidad según la lista de ids dada. */
function reordenarActividades(unidadId, idsOrdenados) {
  return Actividades.reordenar_(abrirCuaderno_(), unidadId, idsOrdenados);
}

/**
 * Todo lo necesario para pintar la rejilla de una unidad:
 * unidad, alumnado, actividades, textos de criterios e ítems guardados.
 */
function getRejilla(unidadId) {
  return Actividades.rejilla_(abrirCuaderno_(), unidadId);
}


var Actividades = (function () {

  function hojaA_(ss) { return ss.getSheetByName(HOJAS.ACTIVIDADES); }

  function listar_(ss, unidadId) {
    return filasAActividades_(hojaA_(ss).getDataRange().getValues(), unidadId);
  }

  /** Convierte los valores crudos de la hoja en actividades de una unidad (ordenadas). */
  function filasAActividades_(datos, unidadId) {
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (f[0] && f[1] === unidadId) {
        out.push({
          actividadId: f[0], unidadId: f[1], nombre: f[2],
          criterios: parseLista_(f[3]), numItems: Number(f[4]) || 0, orden: f[5],
          tipo: f[6] || 'items'
        });
      }
    }
    out.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    return out;
  }

  /** Todas las actividades agrupadas por unidadId (una sola lectura de la hoja). */
  function porUnidad_(ss) {
    var datos = hojaA_(ss).getDataRange().getValues();
    var out = {};
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      (out[f[1]] || (out[f[1]] = [])).push({
        actividadId: f[0], unidadId: f[1], nombre: f[2],
        criterios: parseLista_(f[3]), numItems: Number(f[4]) || 0, orden: f[5],
        tipo: f[6] || 'items'
      });
    }
    Object.keys(out).forEach(function (u) {
      out[u].sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    });
    return out;
  }

  // (el 4º parámetro se conserva por compatibilidad de llamadas; ya no se usa:
  // los criterios pueden ir vacíos en cualquier actividad = columna informativa)
  function crear_(ss, unidadId, p, permitirSinCriterios, ordenDado) {
    validarActividad_(p);
    var id = Datos.nuevoId_('act');
    var tipo = p.tipo || 'items';
    // ordenDado evita releer la hoja en bucles (crear varias / clonar / promocionar).
    var orden = ordenDado != null ? ordenDado : Datos.siguienteOrden_(listar_(ss, unidadId));
    hojaA_(ss).appendRow([
      id, unidadId, p.nombre.trim(), JSON.stringify(p.criterios || []),
      Number(p.numItems) || 0, orden, tipo
    ]);
    return { actividadId: id, unidadId: unidadId, nombre: p.nombre.trim(),
      criterios: p.criterios || [], numItems: Number(p.numItems) || 0,
      orden: orden, tipo: tipo };
  }

  function editar_(ss, actividadId, p) {
    validarActividad_(p);
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) throw new Error('Actividad no encontrada.');
    sh.getRange(fila, 3, 1, 3).setValues([[
      p.nombre.trim(), JSON.stringify(p.criterios || []), Number(p.numItems) || 0
    ]]);
    sh.getRange(fila, 7).setValue(p.tipo || 'items'); // col 7 = tipo (no toca orden)
    return { ok: true };
  }

  /** Borrado suelto de una actividad: a la papelera (con sus notas) y fuera del blob. */
  function eliminar_(ss, actividadId) {
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) return { ok: true };
    var unidadId = sh.getRange(fila, 2).getValue(); // col 2 = unidadId
    Papelera.papelearActividad_(ss, actividadId);
    Notas.quitarActividad_(ss, unidadId, actividadId);
    sh.deleteRow(fila);
    return { ok: true };
  }

  /**
   * Borra en cascada todas las actividades de una unidad, en una sola lectura y
   * de abajo arriba (al borrar la unidad; no toca el blob de notas: la unidad
   * elimina su fila de _notas entera).
   */
  function borrarDeUnidad_(ss, unidadId) {
    var sh = hojaA_(ss);
    var datos = sh.getDataRange().getValues();
    for (var i = datos.length - 1; i >= 1; i--) {
      if (datos[i][1] === unidadId) sh.deleteRow(i + 1);
    }
  }

  function duplicar_(ss, actividadId) {
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) throw new Error('Actividad no encontrada.');
    var f = sh.getRange(fila, 1, 1, 7).getValues()[0];
    return crear_(ss, f[1], {
      nombre: f[2] + ' (copia)', criterios: parseLista_(f[3]),
      numItems: Number(f[4]) || 0, tipo: f[6] || 'items'
    });
  }

  function validarActividad_(p) {
    if (!p || !p.nombre || !p.nombre.trim()) throw new Error('Falta el nombre de la actividad.');
    var tipo = p.tipo || 'items';
    // Los criterios pueden ir vacíos (columna informativa): la interfaz guía,
    // pero el servidor lo admite en cualquier tipo.
    if (tipo === 'items' && !(Number(p.numItems) > 0)) {
      throw new Error('El nº de ítems debe ser mayor que 0.');
    }
    if (tipo === 'contador' && Number(p.numItems) < 0) {
      throw new Error('El máximo del contador no puede ser negativo.');
    }
    // Una observación (texto libre) nunca puntúa: sin criterios, pase lo que
    // pase en el cliente.
    if (tipo === 'texto') p.criterios = [];
  }

  // ---------- rejilla ----------
  function rejilla_(ss, unidadId) {
    var unidad = Unidades.obtener_(ss, unidadId);
    if (!unidad) throw new Error('Unidad no encontrada.');
    var ev = Evaluaciones.obtener_(ss, unidad.evalId);
    // Una sola lectura de _actividades sirve para esta unidad y para el conjunto
    // de criterios asignados en toda la evaluación.
    var datosAct = hojaA_(ss).getDataRange().getValues();
    var actividades = filasAActividades_(datosAct, unidadId);

    // Info de los criterios del área: código -> {texto corto, descripción larga}.
    var criteriosInfo = {};
    Curriculo.criteriosDe(ev.curso, ev.area).forEach(function (c) {
      criteriosInfo[c.codigo] = { texto: c.texto, descripcion: c.descripcion };
    });

    // Notas de la unidad: un único bloque { actividadId: { alumnoId: valor } }.
    var items = Notas.leer_(ss, unidadId);

    return {
      unidad: unidad,
      area: ev.area, curso: ev.curso,
      alumnos: ev.clase.alumnos,
      actividades: actividades,
      criteriosInfo: criteriosInfo,
      items: items,
      // Criterios ya asignados a alguna actividad en CUALQUIER unidad de la clase
      // (cobertura; no depende de que tengan nota).
      asignados: criteriosAsignadosEval_(ss, unidad.evalId, datosAct)
    };
  }

  /** Conjunto de criterios asignados a alguna actividad en toda la evaluación. */
  function criteriosAsignadosEval_(ss, evalId, datos) {
    var setU = {};
    Unidades.listar_(ss, evalId).forEach(function (u) { setU[u.unidadId] = true; });
    datos = datos || hojaA_(ss).getDataRange().getValues();
    var set = {};
    for (var i = 1; i < datos.length; i++) {
      if (setU[datos[i][1]]) {
        parseLista_(datos[i][3]).forEach(function (c) { set[c] = true; });
      }
    }
    return Object.keys(set);
  }

  function parseLista_(json) {
    if (!json) return [];
    try { return JSON.parse(json); } catch (e) { return []; }
  }

  /** Reescribe la columna 'orden' (col 6) según la posición de cada id, en una escritura. */
  function reordenar_(ss, unidadId, ids) {
    if (!ids || !ids.length) return { ok: true };
    var sh = hojaA_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return { ok: true };
    var idCol = sh.getRange(2, 1, n, 1).getValues();
    var ordenCol = sh.getRange(2, 6, n, 1).getValues();
    var pos = {};
    ids.forEach(function (id, idx) { pos[id] = idx + 1; });
    for (var i = 0; i < n; i++) {
      var id = idCol[i][0];
      if (id && pos[id] != null) ordenCol[i][0] = pos[id];
    }
    sh.getRange(2, 6, n, 1).setValues(ordenCol);
    return { ok: true };
  }

  return {
    listar_: listar_, porUnidad_: porUnidad_, crear_: crear_, editar_: editar_,
    eliminar_: eliminar_, borrarDeUnidad_: borrarDeUnidad_,
    duplicar_: duplicar_, rejilla_: rejilla_, reordenar_: reordenar_
  };
})();
