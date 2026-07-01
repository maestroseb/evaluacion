/**
 * Actividades de una unidad, ítems conseguidos por alumno y datos de la rejilla.
 *
 * Cada actividad se asocia a uno o varios criterios y define un nº de ítems.
 * La nota de un alumno en una actividad = ítems_conseguidos / nº_ítems * 10,
 * y esa nota cuenta para cada criterio asociado. (Cálculo en Calc.gs y, en vivo,
 * en el cliente.)
 */

function listarActividades(unidadId) {
  return Actividades.listar_(abrirCuaderno_(), unidadId);
}

/** payload: {nombre, criterios:[codigos], numItems} */
function crearActividad(unidadId, payload) {
  return Actividades.crear_(abrirCuaderno_(), unidadId, payload);
}

/** Crea varias actividades de una vez. lista: [{nombre, criterios, numItems}] */
function crearActividades(unidadId, lista) {
  var ss = abrirCuaderno_();
  return (lista || []).map(function (p) {
    return Actividades.crear_(ss, unidadId, p);
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

/** Guarda los ítems conseguidos de un alumno en una actividad. */
function guardarItem(actividadId, alumnoId, conseguidos) {
  return Actividades.guardarItem_(abrirCuaderno_(), actividadId, alumnoId, conseguidos);
}

/**
 * Guarda muchos ítems de una vez (una sola llamada) de forma eficiente: lee la
 * hoja de ítems una vez, aplica todos los cambios en memoria y la reescribe en
 * bloque. Pensado para pegar grandes cantidades sin timeouts ni llamadas
 * simultáneas. cambios: array de {actividadId, alumnoId, conseguidos}.
 */
function guardarItems(cambios) {
  var ss = abrirCuaderno_();
  var sh = ss.getSheetByName(HOJAS.ITEMS);
  var datos = sh.getDataRange().getValues(); // incluye cabecera

  // Índice de todos los ítems existentes (de todas las unidades): clave -> valor.
  var mapa = {};
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0]) mapa[datos[i][0] + '|' + datos[i][1]] = datos[i][2];
  }
  // Aplica los cambios (vacío = borrar).
  (cambios || []).forEach(function (c) {
    var k = c.actividadId + '|' + c.alumnoId;
    if (c.conseguidos === '' || c.conseguidos == null) delete mapa[k];
    else mapa[k] = Number(c.conseguidos);
  });
  // Reconstruye y reescribe en bloque.
  var filas = Object.keys(mapa).map(function (k) {
    var p = k.split('|');
    return [p[0], p[1], mapa[k]];
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, 3).setValues(filas);
  return { ok: true, n: (cambios || []).length };
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
  function hojaI_(ss) { return ss.getSheetByName(HOJAS.ITEMS); }

  function listar_(ss, unidadId) {
    var datos = hojaA_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (f[0] && f[1] === unidadId) {
        out.push({
          actividadId: f[0], unidadId: f[1], nombre: f[2],
          criterios: parseLista_(f[3]), numItems: Number(f[4]) || 0, orden: f[5]
        });
      }
    }
    out.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    return out;
  }

  function crear_(ss, unidadId, p) {
    validarActividad_(p);
    var id = Datos.nuevoId_('act');
    var orden = listar_(ss, unidadId).length + 1;
    hojaA_(ss).appendRow([
      id, unidadId, p.nombre.trim(), JSON.stringify(p.criterios),
      Number(p.numItems), orden
    ]);
    return { actividadId: id, unidadId: unidadId, nombre: p.nombre.trim(),
      criterios: p.criterios, numItems: Number(p.numItems), orden: orden };
  }

  function editar_(ss, actividadId, p) {
    validarActividad_(p);
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) throw new Error('Actividad no encontrada.');
    sh.getRange(fila, 3, 1, 3).setValues([[
      p.nombre.trim(), JSON.stringify(p.criterios), Number(p.numItems)
    ]]);
    return { ok: true };
  }

  function eliminar_(ss, actividadId, sinPapelera) {
    // A la papelera salvo que ya la cubra una foto de unidad (sinPapelera).
    if (!sinPapelera) Papelera.papelearActividad_(ss, actividadId);
    // Borra los ítems de la actividad y luego la actividad.
    borrarItemsDe_(ss, actividadId);
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila >= 0) sh.deleteRow(fila);
    return { ok: true };
  }

  function duplicar_(ss, actividadId) {
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) throw new Error('Actividad no encontrada.');
    var f = sh.getRange(fila, 1, 1, 6).getValues()[0];
    return crear_(ss, f[1], {
      nombre: f[2] + ' (copia)', criterios: parseLista_(f[3]), numItems: Number(f[4]) || 0
    });
  }

  function validarActividad_(p) {
    if (!p || !p.nombre || !p.nombre.trim()) throw new Error('Falta el nombre de la actividad.');
    if (!p.criterios || !p.criterios.length) throw new Error('Asocia al menos un criterio.');
    if (!(Number(p.numItems) > 0)) throw new Error('El nº de ítems debe ser mayor que 0.');
  }

  // ---------- ítems ----------
  function guardarItem_(ss, actividadId, alumnoId, conseguidos) {
    var sh = hojaI_(ss);
    var datos = sh.getDataRange().getValues();
    var v = conseguidos === '' || conseguidos == null ? '' : Number(conseguidos);
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === actividadId && datos[i][1] === alumnoId) {
        if (v === '') { sh.deleteRow(i + 1); return { ok: true }; }
        sh.getRange(i + 1, 3).setValue(v);
        return { ok: true };
      }
    }
    if (v !== '') sh.appendRow([actividadId, alumnoId, v]);
    return { ok: true };
  }

  function borrarItemsDe_(ss, actividadId) {
    var sh = hojaI_(ss);
    var datos = sh.getDataRange().getValues();
    for (var i = datos.length - 1; i >= 1; i--) {
      if (datos[i][0] === actividadId) sh.deleteRow(i + 1);
    }
  }

  // ---------- rejilla ----------
  function rejilla_(ss, unidadId) {
    var unidad = Unidades.obtener_(ss, unidadId);
    if (!unidad) throw new Error('Unidad no encontrada.');
    var ev = Evaluaciones.obtener_(ss, unidad.evalId);
    var actividades = listar_(ss, unidadId);

    // Info de los criterios del área: código -> {texto corto, descripción larga}.
    var criteriosInfo = {};
    Curriculo.criteriosDe(ev.curso, ev.area).forEach(function (c) {
      criteriosInfo[c.codigo] = { texto: c.texto, descripcion: c.descripcion };
    });

    // Ítems guardados de las actividades de esta unidad.
    var idsAct = {};
    actividades.forEach(function (a) { idsAct[a.actividadId] = true; });
    var items = {};
    var datosI = hojaI_(ss).getDataRange().getValues();
    for (var i = 1; i < datosI.length; i++) {
      var f = datosI[i];
      if (idsAct[f[0]]) {
        (items[f[0]] || (items[f[0]] = {}))[f[1]] = Number(f[2]);
      }
    }

    return {
      unidad: unidad,
      area: ev.area, curso: ev.curso,
      alumnos: ev.clase.alumnos,
      actividades: actividades,
      criteriosInfo: criteriosInfo,
      items: items,
      // Criterios ya asignados a alguna actividad en CUALQUIER unidad de la clase
      // (cobertura; no depende de que tengan nota).
      asignados: criteriosAsignadosEval_(ss, unidad.evalId)
    };
  }

  /** Conjunto de criterios asignados a alguna actividad en toda la evaluación. */
  function criteriosAsignadosEval_(ss, evalId) {
    var setU = {};
    Unidades.listar_(ss, evalId).forEach(function (u) { setU[u.unidadId] = true; });
    var datos = hojaA_(ss).getDataRange().getValues();
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

  /** Reescribe la columna 'orden' (col 6) según la posición de cada id. */
  function reordenar_(ss, unidadId, ids) {
    if (!ids || !ids.length) return { ok: true };
    var sh = hojaA_(ss);
    var datos = sh.getDataRange().getValues();
    var filaDe = {};
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] && datos[i][1] === unidadId) filaDe[datos[i][0]] = i + 1;
    }
    ids.forEach(function (id, idx) {
      var fila = filaDe[id];
      if (fila) sh.getRange(fila, 6).setValue(idx + 1);
    });
    return { ok: true };
  }

  return {
    listar_: listar_, crear_: crear_, editar_: editar_, eliminar_: eliminar_,
    duplicar_: duplicar_, guardarItem_: guardarItem_, rejilla_: rejilla_,
    reordenar_: reordenar_
  };
})();
