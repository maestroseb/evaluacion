/**
 * Clases: la lista de alumnado + curso, reutilizable en varias evaluaciones.
 *
 * El alumnado va serializado como JSON en la columna "alumnos": [{id, nombre}].
 * Cada alumno tiene un id estable para conservar sus notas aunque se reordene
 * o renombre la clase.
 *
 * Funciones públicas (sin guion bajo) = invocables desde el frontend.
 */

function listarClases() {
  return Clases.listar_(abrirCuaderno_());
}

/** Crea una clase. payload: {nombre, curso, alumnos:[{nombre}]} */
function crearClase(payload) {
  return Clases.crear_(abrirCuaderno_(), payload);
}

function obtenerClase(claseId) {
  return Clases.obtener_(abrirCuaderno_(), claseId);
}

/** Reemplaza el alumnado de una clase. alumnos: [{id?, nombre}] */
function actualizarAlumnosClase(claseId, alumnos) {
  return Clases.actualizarAlumnos_(abrirCuaderno_(), claseId, alumnos);
}

function renombrarClase(claseId, nombre) {
  return Clases.renombrar_(abrirCuaderno_(), claseId, nombre);
}

function eliminarClase(claseId) {
  return Clases.eliminar_(abrirCuaderno_(), claseId);
}


var Clases = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.CLASES); }

  function listar_(ss) {
    var sh = hoja_(ss);
    var datos = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      out.push({
        claseId: f[0], nombre: f[1], curso: f[2], creado: f[3],
        numAlumnos: contar_(f[4])
      });
    }
    return out;
  }

  function crear_(ss, payload) {
    validar_(payload && payload.nombre, 'el nombre de la clase');
    validar_(payload.curso, 'el curso');
    var claseId = Datos.nuevoId_('c');
    var alumnos = normalizarAlumnos_(payload.alumnos || []);
    hoja_(ss).appendRow([
      claseId, payload.nombre.trim(), payload.curso,
      new Date().toISOString(), JSON.stringify(alumnos)
    ]);
    return obtener_(ss, claseId);
  }

  function obtener_(ss, claseId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    var f = sh.getRange(fila, 1, 1, 5).getValues()[0];
    return {
      claseId: f[0], nombre: f[1], curso: f[2], creado: f[3],
      alumnos: parse_(f[4])
    };
  }

  function actualizarAlumnos_(ss, claseId, alumnos) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    sh.getRange(fila, 5).setValue(JSON.stringify(normalizarAlumnos_(alumnos)));
    return obtener_(ss, claseId);
  }

  function renombrar_(ss, claseId, nombre) {
    validar_(nombre, 'el nombre de la clase');
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    sh.getRange(fila, 2).setValue(nombre.trim());
    return obtener_(ss, claseId);
  }

  function eliminar_(ss, claseId) {
    if (Evaluaciones.usaClase_(ss, claseId)) {
      throw new Error('Este grupo tiene clases asociadas. Elimínalas antes.');
    }
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    sh.deleteRow(fila);
    return { ok: true };
  }

  /** Ids estables y sin vacíos/duplicados. Entrada [{id?,nombre}]. */
  function normalizarAlumnos_(lista) {
    var out = [], vistos = {};
    (lista || []).forEach(function (a) {
      var nombre = String((a && a.nombre) || '').trim();
      if (!nombre) return;
      var id = (a && a.id) || Datos.nuevoId_('a');
      if (vistos[id]) id = Datos.nuevoId_('a');
      vistos[id] = true;
      out.push({ id: id, nombre: nombre });
    });
    return out;
  }

  function parse_(json) {
    if (!json) return [];
    try { return JSON.parse(json); } catch (e) { return []; }
  }
  function contar_(json) {
    var a = parse_(json); return a.length;
  }
  function validar_(v, que) {
    if (!v || !String(v).trim()) throw new Error('Falta ' + que + '.');
  }

  return {
    listar_: listar_, crear_: crear_, obtener_: obtener_,
    actualizarAlumnos_: actualizarAlumnos_, renombrar_: renombrar_,
    eliminar_: eliminar_
  };
})();
