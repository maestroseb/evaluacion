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

/**
 * Todos los criterios ya "evaluados" = asignados a alguna actividad del
 * cuaderno (en cualquier clase/unidad). Lo usa el planificador para señalar,
 * de lo que programa, qué está ya recogido en la evaluación. Devuelve un array
 * de códigos (datos del propio profe, sin datos personales del alumnado).
 */
function criteriosEvaluados() {
  var ss = abrirCuaderno_();
  var datos = ss.getSheetByName(HOJAS.ACTIVIDADES).getDataRange().getValues();
  var set = {};
  for (var i = 1; i < datos.length; i++) {
    var raw = datos[i][3]; // col 4 = criterios (JSON)
    if (!raw) continue;
    try {
      JSON.parse(raw).forEach(function (c) { if (c) set[c] = true; });
    } catch (e) { /* fila con criterios ilegibles: se ignora */ }
  }
  return Object.keys(set);
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
          tipo: f[6] || 'items', desglose: !!f[7], rubricaId: f[8] || '',
          rubMap: parseLista_(f[9])
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
        tipo: f[6] || 'items', desglose: !!f[7], rubricaId: f[8] || '',
        rubMap: parseLista_(f[9])
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
      Number(p.numItems) || 0, orden, tipo, p.desglose ? 1 : '', p.rubricaId || '',
      JSON.stringify(p.rubMap || [])
    ]);
    return { actividadId: id, unidadId: unidadId, nombre: p.nombre.trim(),
      criterios: p.criterios || [], numItems: Number(p.numItems) || 0,
      orden: orden, tipo: tipo, desglose: !!p.desglose, rubricaId: p.rubricaId || '',
      rubMap: p.rubMap || [] };
  }

  function editar_(ss, actividadId, p) {
    validarActividad_(p);
    var sh = hojaA_(ss);
    var fila = Datos.filaDeId_(sh, actividadId);
    if (fila < 0) throw new Error('Actividad no encontrada.');
    var unidadId = sh.getRange(fila, 2).getValue(); // col 2 = unidadId
    sh.getRange(fila, 3, 1, 3).setValues([[
      p.nombre.trim(), JSON.stringify(p.criterios || []), Number(p.numItems) || 0
    ]]);
    // cols 7-10 = tipo, desglose, rubricaId y rubMap (no tocan el orden, col 6)
    sh.getRange(fila, 7, 1, 4).setValues([[
      p.tipo || 'items', p.desglose ? 1 : '', p.rubricaId || '', JSON.stringify(p.rubMap || [])
    ]]);
    if (p.desglose) repartirDesglose_(ss, unidadId, actividadId, p.criterios || []);
    return { ok: true };
  }

  /**
   * Con desglose activo, las notas ÚNICAS que hubiera en el blob (puestas antes
   * de activarlo) se reparten: la misma nota a todos los criterios de la
   * actividad, como {criterio: nota}. Así se ven y se ajustan las que difieran,
   * en vez de quedar ocultas de fondo. Los objetos (ya desglosados) y los
   * textos no se tocan.
   */
  function repartirDesglose_(ss, unidadId, actividadId, criterios) {
    if (!criterios.length) return;
    var items = Notas.leer_(ss, unidadId);
    var m = items[actividadId];
    if (!m) return;
    var cambia = false;
    Object.keys(m).forEach(function (alId) {
      if (typeof m[alId] !== 'number') return;
      var obj = {};
      criterios.forEach(function (cod) { obj[cod] = m[alId]; });
      m[alId] = obj;
      cambia = true;
    });
    if (cambia) Notas.guardar_(ss, unidadId, items);
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
    var f = sh.getRange(fila, 1, 1, 10).getValues()[0];
    return crear_(ss, f[1], {
      nombre: f[2] + ' (copia)', criterios: parseLista_(f[3]),
      numItems: Number(f[4]) || 0, tipo: f[6] || 'items', desglose: !!f[7],
      rubricaId: f[8] || '', rubMap: parseLista_(f[9])
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
    if (tipo === 'rubrica' && !(p.rubricaId && String(p.rubricaId).trim())) {
      throw new Error('Elige una rúbrica para la columna.');
    }
    // rubricaId y rubMap solo tienen sentido en columnas de tipo rúbrica.
    if (tipo !== 'rubrica') { p.rubricaId = ''; p.rubMap = []; }
    // Una observación (texto libre) nunca puntúa: sin criterios, pase lo que
    // pase en el cliente.
    if (tipo === 'texto') p.criterios = [];
    // Nota por criterio: solo tiene sentido con 2+ criterios y en tipos cuyo
    // valor es una nota puntual (fuera contador y texto).
    p.desglose = !!p.desglose && (p.criterios || []).length > 1 &&
      tipo !== 'contador' && tipo !== 'texto';
  }

  // ---------- rejilla ----------
  function rejilla_(ss, unidadId) {
    // Una sola lectura de _unidades da la unidad Y el conjunto de sus hermanas
    // (antes: localizar la fila + leerla + relistar la hoja entera).
    var datosU = ss.getSheetByName(HOJAS.UNIDADES).getDataRange().getValues();
    var unidad = null;
    for (var i = 1; i < datosU.length; i++) {
      if (datosU[i][0] === unidadId) {
        unidad = { unidadId: datosU[i][0], evalId: datosU[i][1],
          nombre: datosU[i][2], orden: datosU[i][3] };
        break;
      }
    }
    if (!unidad) throw new Error('Unidad no encontrada.');
    // Las DEMÁS unidades de la misma evaluación (para asignadosFuera).
    var setU = {};
    for (i = 1; i < datosU.length; i++) {
      if (datosU[i][1] === unidad.evalId && datosU[i][0] !== unidadId) {
        setU[datosU[i][0]] = true;
      }
    }
    var ev = Evaluaciones.obtener_(ss, unidad.evalId);
    // Una sola lectura de _actividades sirve para esta unidad y para el conjunto
    // de criterios asignados en toda la evaluación.
    var datosAct = hojaA_(ss).getDataRange().getValues();
    var actividades = filasAActividades_(datosAct, unidadId);

    // Info de los criterios del área: código -> {texto corto, descripción larga}.
    var criteriosInfo = {};
    Curriculo.criteriosDe(ev.curso, ev.area, MapaPropio.filas_(ss)).forEach(function (c) {
      criteriosInfo[c.codigo] = { texto: c.texto, descripcion: c.descripcion };
    });

    // Notas de la unidad: un único bloque { actividadId: { alumnoId: valor } }.
    var items = Notas.leer_(ss, unidadId);

    // Definiciones de las rúbricas usadas por columnas de tipo "rubrica": el
    // evaluador y el cálculo /10 las necesitan (indicadores, niveles, pesos).
    var rubricas = {};
    actividades.forEach(function (a) {
      if (a.tipo === 'rubrica' && a.rubricaId && !rubricas[a.rubricaId]) {
        try { rubricas[a.rubricaId] = Rubricas.obtener_(ss, a.rubricaId); }
        catch (e) { Logger.log('rejilla_: rúbrica ' + a.rubricaId + ' no disponible: ' + e); }
      }
    });

    return {
      unidad: unidad,
      area: ev.area, curso: ev.curso,
      alumnos: ev.clase.alumnos,
      actividades: actividades,
      criteriosInfo: criteriosInfo,
      items: items,
      rubricas: rubricas,
      // Criterios asignados en las DEMÁS unidades de la clase. Los de ESTA
      // unidad los calcula el cliente en vivo desde sus actividades: así, al
      // quitar un criterio de la única actividad que lo usaba, recupera la
      // etiqueta «no evaluado» sin volver al servidor.
      asignadosFuera: criteriosEnUnidades_(datosAct, setU)
    };
  }

  /** Conjunto de criterios asignados a actividades de las unidades dadas. */
  function criteriosEnUnidades_(datos, setU) {
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
    return Datos.reordenarPorIds_(hojaA_(ss), 6, ids); // col 6 = orden
  }

  return {
    listar_: listar_, porUnidad_: porUnidad_, crear_: crear_, editar_: editar_,
    eliminar_: eliminar_, borrarDeUnidad_: borrarDeUnidad_,
    duplicar_: duplicar_, rejilla_: rejilla_, reordenar_: reordenar_
  };
})();
