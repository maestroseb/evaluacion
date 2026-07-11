/**
 * Planificador de sesiones (v16). Una sesión es contenido pedagógico
 * reutilizable (título, descripción, criterios trabajados) que se ASIGNA a una
 * o varias clases: el mismo guion sirve para 3ºA y 3ºB, y cada asignación
 * lleva su propia fecha y su propio estado (cada grupo avanza a su ritmo).
 *
 * Modelo de una sesión:
 *   - titulo, descripcion: el contenido compartido.
 *   - criterios: [codigo, …] criterios de evaluación que trabaja la sesión.
 *   - asignaciones: [{ evalId, fecha:'YYYY-MM-DD', estado }]
 *       estado ∈ pendiente | hecha | aplazada. Una sesión sin asignaciones es
 *       un borrador del banco ("sin programar").
 *
 * Las sesiones son contenido pedagógico (no datos personales del alumnado),
 * así que se guardan en claro, sin cifrar.
 *
 * Todo el módulo vive tras la bandera FLAGS.planner (la interfaz no lo enseña
 * a quien no la tenga).
 *
 * Funciones públicas (sin guion bajo) = invocables desde el frontend.
 */

/** payload: {titulo, descripcion, criterios:[codigos], asignaciones:[{evalId,fecha,estado}]} */
function crearSesion(payload) {
  return Planner.crear_(abrirCuaderno_(), payload);
}

/** Todas las sesiones completas (son ligeras: sin notas ni alumnado). */
function listarSesiones() {
  return Planner.listar_(abrirCuaderno_());
}

function editarSesion(sesionId, payload) {
  return Planner.editar_(abrirCuaderno_(), sesionId, payload);
}

function eliminarSesion(sesionId) {
  return Planner.eliminar_(abrirCuaderno_(), sesionId);
}

/** Duplica una sesión (mismo contenido, sin asignaciones, nuevo id). */
function duplicarSesion(sesionId) {
  return Planner.duplicar_(abrirCuaderno_(), sesionId);
}

/** Cambia el estado (y opcionalmente la fecha) de UNA asignación de la sesión. */
function estadoSesion(sesionId, evalId, estado, fecha) {
  return Planner.cambiarEstado_(abrirCuaderno_(), sesionId, evalId, estado, fecha);
}

/** Lista las unidades de planificación del profe (por materia/área). */
function listarPlanUnidades() {
  return Planner.listarU_(abrirCuaderno_());
}
/** Crea una unidad de planificación. */
function crearPlanUnidad(nombre, area, curso) {
  return Planner.crearU_(abrirCuaderno_(), nombre, area, curso);
}
function editarPlanUnidad(unidadId, nombre, area, curso) {
  return Planner.editarU_(abrirCuaderno_(), unidadId, nombre, area, curso);
}
/** Elimina una unidad; las sesiones que la usaban quedan sin unidad. */
function eliminarPlanUnidad(unidadId) {
  return Planner.eliminarU_(abrirCuaderno_(), unidadId);
}

var Planner = (function () {

  var ESTADOS = { pendiente: true, hecha: true, aplazada: true };

  function hoja_(ss) { return ss.getSheetByName(HOJAS.PLANNER); }

  function listar_(ss) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      out.push({
        sesionId: f[0], titulo: f[1], descripcion: f[2],
        criterios: parse_(f[3]), asignaciones: parse_(f[4]),
        creado: f[5], orden: Number(f[6]) || 0, tipo: f[7] || 'clase', unidadId: f[8] || ''
      });
    }
    out.sort(function (a, b) { return a.orden - b.orden; });
    return out;
  }

  function obtener_(ss, sesionId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, sesionId);
    if (fila < 0) throw new Error('Sesión no encontrada.');
    var f = sh.getRange(fila, 1, 1, 9).getValues()[0];
    return {
      sesionId: f[0], titulo: f[1], descripcion: f[2],
      criterios: parse_(f[3]), asignaciones: parse_(f[4]),
      creado: f[5], orden: Number(f[6]) || 0, tipo: f[7] || 'clase', unidadId: f[8] || ''
    };
  }

  function crear_(ss, payload) {
    var limpio = validarYNormalizar_(payload);
    var id = Datos.nuevoId_('ses');
    var orden = Datos.siguienteOrden_(listar_(ss));
    hoja_(ss).appendRow([
      id, limpio.titulo, limpio.descripcion, JSON.stringify(limpio.criterios),
      JSON.stringify(limpio.asignaciones), new Date().toISOString(), orden, limpio.tipo,
      limpio.unidadId
    ]);
    return obtener_(ss, id);
  }

  function editar_(ss, sesionId, payload) {
    var limpio = validarYNormalizar_(payload);
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, sesionId);
    if (fila < 0) throw new Error('Sesión no encontrada.');
    // cols 2-5 = titulo, descripcion, criterios, asignaciones (no toca creado ni orden)
    sh.getRange(fila, 2, 1, 4).setValues([[
      limpio.titulo, limpio.descripcion,
      JSON.stringify(limpio.criterios), JSON.stringify(limpio.asignaciones)
    ]]);
    sh.getRange(fila, 8).setValue(limpio.tipo);       // col 8 = tipo
    sh.getRange(fila, 9).setValue(limpio.unidadId);   // col 9 = unidad de planificación
    return obtener_(ss, sesionId);
  }

  function eliminar_(ss, sesionId) {
    Papelera.papelearSesion_(ss, sesionId); // a la papelera antes de borrar
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, sesionId);
    if (fila < 0) return { ok: true };
    sh.deleteRow(fila);
    return { ok: true };
  }

  function duplicar_(ss, sesionId) {
    var orig = obtener_(ss, sesionId);
    // La copia nace SIN asignaciones: lo normal es duplicar para reprogramar
    // el mismo contenido en otras fechas u otras clases.
    return crear_(ss, {
      titulo: orig.titulo + ' (copia)', descripcion: orig.descripcion,
      criterios: orig.criterios, asignaciones: [], tipo: orig.tipo, unidadId: orig.unidadId
    });
  }

  function cambiarEstado_(ss, sesionId, evalId, estado, fecha) {
    if (!ESTADOS[estado]) throw new Error('Estado no válido.');
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, sesionId);
    if (fila < 0) throw new Error('Sesión no encontrada.');
    var asigs = parse_(sh.getRange(fila, 5).getValue());
    var tocada = false;
    asigs.forEach(function (a) {
      if (a.evalId === evalId) {
        a.estado = estado;
        if (fecha) a.fecha = fechaValida_(fecha);
        tocada = true;
      }
    });
    if (!tocada) throw new Error('Esta sesión no está asignada a esa clase.');
    sh.getRange(fila, 5).setValue(JSON.stringify(asigs));
    return obtener_(ss, sesionId);
  }

  // ---------- migración de clases provisionales (v18 → v19) ----------
  // Las provisionales dejan de existir como concepto aparte: cada una se
  // convierte en una clase real SIN grupo (conservando su nombre y su horario)
  // y sus sesiones se re-apuntan a la nueva clase. Idempotente: al vaciar la
  // pestaña, no se vuelve a ejecutar.

  function hojaProv_(ss) { return ss.getSheetByName(HOJAS.PROVISIONALES); }

  function migrarProvisionales_(ss) {
    var sh = hojaProv_(ss);
    if (!sh || sh.getLastRow() < 2) return; // solo cabecera (o no existe): nada que migrar
    var datos = sh.getDataRange().getValues();
    var mapa = {}; // provId -> nuevo evalId
    for (var i = 1; i < datos.length; i++) {
      var r = datos[i];
      if (!r[0]) continue;
      var ev = Evaluaciones.crear_(ss, { nombre: r[1] }); // clase real sin grupo
      Evaluaciones.fusionarHorario_(ss, ev.evalId, parse_(r[2])); // conserva su horario
      mapa[r[0]] = ev.evalId;
    }
    // Re-apunta las asignaciones de las sesiones (prov → nueva clase).
    Object.keys(mapa).forEach(function (provId) { reasignar_(ss, provId, mapa[provId]); });
    // Vacía la pestaña: la migración no se repite.
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    }
  }

  /**
   * Reescribe las asignaciones de TODAS las sesiones: las que apuntaban a `id`
   * pasan a `nuevoId` (o desaparecen si es null). Si la sesión ya estaba
   * asignada al destino, no se duplica (se conserva la existente).
   */
  function reasignar_(ss, id, nuevoId) {
    var sh = hoja_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return;
    var rango = sh.getRange(2, 5, n, 1); // col 5 = asignaciones
    var vals = rango.getValues();
    var cambiado = false;
    for (var i = 0; i < n; i++) {
      var asigs = parse_(vals[i][0]);
      if (!asigs.some(function (a) { return a.evalId === id; })) continue;
      var out = [], vistos = {};
      asigs.forEach(function (a) {
        var destino = (a.evalId === id) ? nuevoId : a.evalId;
        if (!destino || vistos[destino]) return;
        vistos[destino] = true;
        out.push({ evalId: destino, fecha: a.fecha || '', estado: a.estado,
          observaciones: a.observaciones || '' });
      });
      vals[i][0] = JSON.stringify(out);
      cambiado = true;
    }
    if (cambiado) rango.setValues(vals);
  }

  // ---------- validación / normalización ----------

  /**
   * Deja el payload en forma canónica y valida lo imprescindible: título y
   * asignaciones bien formadas (evalId sin duplicar, fecha ISO o vacía, estado
   * conocido). Blinda tipos para que la hoja no guarde basura del cliente.
   */
  var TIPOS = { clase: true, evento: true, aviso: true };

  function mapAsig_(a) {
    return {
      evalId: String((a && a.evalId) || '').trim(),
      fecha: fechaValida_(a && a.fecha),
      estado: ESTADOS[a && a.estado] ? a.estado : 'pendiente',
      // Nota corta del desvío en ESE grupo (la plantilla es compartida).
      observaciones: String((a && a.observaciones) || '').slice(0, 2000)
    };
  }

  function validarYNormalizar_(payload) {
    var titulo = String((payload && payload.titulo) || '').trim();
    if (!titulo) throw new Error('Falta el título de la sesión.');

    var tipo = (payload && TIPOS[payload.tipo]) ? payload.tipo : 'clase';
    var raw = Array.isArray(payload.asignaciones) ? payload.asignaciones : [];
    var asignaciones;
    if (tipo === 'clase') {
      // Una asignación por grupo (evalId real, sin duplicar).
      var vistos = {};
      asignaciones = raw.map(mapAsig_).filter(function (a) {
        if (!a.evalId || vistos[a.evalId]) return false;
        vistos[a.evalId] = true;
        return true;
      });
    } else {
      // Evento / aviso: una única asignación "general" (sin grupo).
      var a0 = raw.length ? mapAsig_(raw[0]) : { fecha: '', estado: 'pendiente', observaciones: '' };
      asignaciones = [{ evalId: '', fecha: a0.fecha, estado: a0.estado, observaciones: '' }];
    }

    return {
      titulo: titulo,
      tipo: tipo,
      descripcion: String((payload && payload.descripcion) || '').slice(0, 8000),
      // Los criterios solo tienen sentido en una sesión de clase.
      criterios: tipo === 'clase' ? codigos_(payload && payload.criterios) : [],
      asignaciones: asignaciones,
      // Unidad de planificación a la que pertenece (opcional).
      unidadId: String((payload && payload.unidadId) || '').trim()
    };
  }

  // ---------- unidades de planificación (por materia/área) ----------
  function hojaU_(ss) { return ss.getSheetByName(HOJAS.PLAN_UNIDADES); }

  function listarU_(ss) {
    var datos = hojaU_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      out.push({ unidadId: f[0], area: f[1] || '', nombre: f[2] || '',
        orden: Number(f[3]) || 0, creado: f[4], curso: f[5] || '' });
    }
    out.sort(function (a, b) { return a.orden - b.orden; });
    return out;
  }

  function crearU_(ss, nombre, area, curso) {
    var n = String(nombre || '').trim().slice(0, 120);
    if (!n) throw new Error('Pon nombre a la unidad de planificación.');
    var a = String(area || '').trim(), c = String(curso || '').trim();
    var id = Datos.nuevoId_('pu');
    var orden = Datos.siguienteOrden_(listarU_(ss));
    hojaU_(ss).appendRow([id, a, n, orden, new Date().toISOString(), c]);
    return { unidadId: id, area: a, nombre: n, orden: orden, curso: c };
  }

  function editarU_(ss, unidadId, nombre, area, curso) {
    var sh = hojaU_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila < 0) throw new Error('Unidad de planificación no encontrada.');
    var n = String(nombre || '').trim().slice(0, 120);
    if (!n) throw new Error('Pon nombre a la unidad de planificación.');
    var a = String(area || '').trim(), c = String(curso || '').trim();
    sh.getRange(fila, 2, 1, 2).setValues([[a, n]]); // col 2 = area, col 3 = nombre
    sh.getRange(fila, 6).setValue(c);               // col 6 = curso
    return { unidadId: unidadId, area: a, nombre: n, curso: c };
  }

  function eliminarU_(ss, unidadId) {
    desligarUnidad_(ss, unidadId); // las sesiones que la usaban quedan sin unidad
    var sh = hojaU_(ss);
    var fila = Datos.filaDeId_(sh, unidadId);
    if (fila >= 0) sh.deleteRow(fila);
    return { ok: true };
  }

  /** Vacía la columna unidadId (col 9) de las sesiones que apuntaban a la unidad. */
  function desligarUnidad_(ss, unidadId) {
    var sh = hoja_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return;
    var rango = sh.getRange(2, 9, n, 1);
    var vals = rango.getValues();
    var cambiado = false;
    for (var i = 0; i < n; i++) {
      if (vals[i][0] === unidadId) { vals[i][0] = ''; cambiado = true; }
    }
    if (cambiado) rango.setValues(vals);
  }

  /** Fecha en formato YYYY-MM-DD, o '' (asignada sin fecha aún). */
  function fechaValida_(v) {
    var s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  /** Lista de códigos de criterio: strings recortados, sin vacíos ni duplicados. */
  function codigos_(lista) {
    var out = [], vistos = {};
    (Array.isArray(lista) ? lista : []).forEach(function (c) {
      var cod = String(c || '').trim();
      if (cod && !vistos[cod]) { vistos[cod] = true; out.push(cod); }
    });
    return out;
  }

  function parse_(json) {
    if (!json) return [];
    try { var v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  return {
    listar_: listar_, obtener_: obtener_, crear_: crear_, editar_: editar_,
    eliminar_: eliminar_, duplicar_: duplicar_, cambiarEstado_: cambiarEstado_,
    migrarProvisionales_: migrarProvisionales_,
    listarU_: listarU_, crearU_: crearU_, editarU_: editarU_, eliminarU_: eliminarU_
  };
})();
