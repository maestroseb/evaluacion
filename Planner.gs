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
        creado: f[5], orden: Number(f[6]) || 0
      });
    }
    out.sort(function (a, b) { return a.orden - b.orden; });
    return out;
  }

  function obtener_(ss, sesionId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, sesionId);
    if (fila < 0) throw new Error('Sesión no encontrada.');
    var f = sh.getRange(fila, 1, 1, 7).getValues()[0];
    return {
      sesionId: f[0], titulo: f[1], descripcion: f[2],
      criterios: parse_(f[3]), asignaciones: parse_(f[4]),
      creado: f[5], orden: Number(f[6]) || 0
    };
  }

  function crear_(ss, payload) {
    var limpio = validarYNormalizar_(payload);
    var id = Datos.nuevoId_('ses');
    var orden = Datos.siguienteOrden_(listar_(ss));
    hoja_(ss).appendRow([
      id, limpio.titulo, limpio.descripcion, JSON.stringify(limpio.criterios),
      JSON.stringify(limpio.asignaciones), new Date().toISOString(), orden
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
      criterios: orig.criterios, asignaciones: []
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

  // ---------- validación / normalización ----------

  /**
   * Deja el payload en forma canónica y valida lo imprescindible: título y
   * asignaciones bien formadas (evalId sin duplicar, fecha ISO o vacía, estado
   * conocido). Blinda tipos para que la hoja no guarde basura del cliente.
   */
  function validarYNormalizar_(payload) {
    var titulo = String((payload && payload.titulo) || '').trim();
    if (!titulo) throw new Error('Falta el título de la sesión.');

    var vistos = {};
    var asignaciones = (Array.isArray(payload.asignaciones) ? payload.asignaciones : [])
      .map(function (a) {
        return {
          evalId: String((a && a.evalId) || '').trim(),
          fecha: fechaValida_(a && a.fecha),
          estado: ESTADOS[a && a.estado] ? a.estado : 'pendiente'
        };
      })
      .filter(function (a) {
        if (!a.evalId || vistos[a.evalId]) return false;
        vistos[a.evalId] = true;
        return true;
      });

    return {
      titulo: titulo,
      descripcion: String((payload && payload.descripcion) || '').slice(0, 8000),
      criterios: codigos_(payload && payload.criterios),
      asignaciones: asignaciones
    };
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
    eliminar_: eliminar_, duplicar_: duplicar_, cambiarEstado_: cambiarEstado_
  };
})();
