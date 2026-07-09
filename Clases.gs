/**
 * Clases: la lista de alumnado + curso, reutilizable en varias evaluaciones.
 *
 * El alumnado va serializado como JSON en la columna "alumnos": [{id, nombre}].
 * Cada alumno tiene un id estable para conservar sus notas aunque se reordene
 * o renombre la clase.
 *
 * Funciones públicas (sin guion bajo) = invocables desde el frontend.
 */

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

/** Edita nombre, color e icono de un grupo (no toca curso ni alumnado). */
function editarClase(claseId, payload) {
  return Clases.editar_(abrirCuaderno_(), claseId, payload);
}

function eliminarClase(claseId) {
  return Clases.eliminar_(abrirCuaderno_(), claseId);
}

/** Elimina un grupo Y todas sus clases (evaluaciones) en cascada. */
function eliminarClaseConTodo(claseId) {
  return Clases.eliminarConTodo_(abrirCuaderno_(), claseId);
}

/** Archiva (si=true) o restaura (si=false) un grupo: fuera de la vista, sin borrar. */
function archivarClase(claseId, si) {
  return Clases.archivar_(abrirCuaderno_(), claseId, si);
}

/** Reordena los grupos según el nuevo orden de ids en la rejilla. */
function reordenarClases(ids) {
  return Clases.reordenar_(abrirCuaderno_(), ids);
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
        numAlumnos: contar_(f[4]), color: f[5] || '', icono: f[6] || '',
        orden: Number(f[7]) || 0, cursoAcademico: f[8] || '',
        archivado: !!f[10]
      });
    }
    out.sort(function (a, b) { return a.orden - b.orden; }); // orden guardado (0 = antiguos)
    return out;
  }

  function crear_(ss, payload) {
    validar_(payload && payload.nombre, 'el nombre de la clase');
    validar_(payload.curso, 'el curso');
    var claseId = Datos.nuevoId_('c');
    var alumnos = normalizarAlumnos_(payload.alumnos || []);
    var orden = Datos.siguienteOrden_(listar_(ss));
    var cursoAcad = (payload.cursoAcademico && String(payload.cursoAcademico).trim())
      || Cursos.activo_();
    hoja_(ss).appendRow([
      claseId, payload.nombre.trim(), payload.curso,
      new Date().toISOString(), serializar_(alumnos),
      payload.color || '', payload.icono || '', orden, cursoAcad, ''
    ]);
    return obtener_(ss, claseId);
  }

  /** Reordena los grupos según la lista de ids (col 8 = orden), en una escritura. */
  function reordenar_(ss, ids) {
    if (!ids || !ids.length) return { ok: true };
    var sh = hoja_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return { ok: true };
    var idCol = sh.getRange(2, 1, n, 1).getValues();
    var ordenCol = sh.getRange(2, 8, n, 1).getValues();
    var pos = {};
    ids.forEach(function (id, idx) { pos[id] = idx + 1; });
    for (var i = 0; i < n; i++) {
      var id = idCol[i][0];
      if (id && pos[id] != null) ordenCol[i][0] = pos[id];
    }
    sh.getRange(2, 8, n, 1).setValues(ordenCol);
    return { ok: true };
  }

  function obtener_(ss, claseId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    var f = sh.getRange(fila, 1, 1, 10).getValues()[0];
    return {
      claseId: f[0], nombre: f[1], curso: f[2], creado: f[3],
      alumnos: deserializar_(f[4]), color: f[5] || '', icono: f[6] || '',
      cursoAcademico: f[8] || '',
      // Alumnado retirado de la lista: permite reincorporar con sus notas.
      bajas: deserializar_(f[9])
    };
  }

  /** Actualiza nombre (col 2), color (col 6) e icono (col 7). */
  function editar_(ss, claseId, payload) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    if (payload && payload.nombre != null && String(payload.nombre).trim()) {
      sh.getRange(fila, 2).setValue(String(payload.nombre).trim());
    }
    sh.getRange(fila, 6, 1, 2).setValues([[(payload && payload.color) || '',
      (payload && payload.icono) || '']]);
    return obtener_(ss, claseId);
  }

  function actualizarAlumnos_(ss, claseId, alumnos) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    var previos = deserializar_(sh.getRange(fila, 5).getValue());
    var nuevos = normalizarAlumnos_(alumnos);

    // Mantiene la lista de bajas (col 10): quien sale de la lista entra en
    // bajas (recientes primero); quien reaparece en la lista sale de bajas.
    // Así, re-añadir a un alumno/a con su mismo nombre recupera su id y notas.
    var enLista = {};
    nuevos.forEach(function (a) { enLista[a.id] = true; });
    var bajas = previos.filter(function (a) { return a.id && !enLista[a.id]; });
    var vistos = {};
    bajas.forEach(function (b) { vistos[b.id] = true; });
    deserializar_(sh.getRange(fila, 10).getValue()).forEach(function (b) {
      if (b.id && !enLista[b.id] && !vistos[b.id]) { vistos[b.id] = true; bajas.push(b); }
    });
    bajas = bajas.slice(0, 60); // techo defensivo: no crece sin límite

    sh.getRange(fila, 5).setValue(serializar_(nuevos));
    sh.getRange(fila, 10).setValue(serializar_(bajas));
    return obtener_(ss, claseId);
  }

  function eliminar_(ss, claseId) {
    if (Evaluaciones.usaClase_(ss, claseId)) {
      throw new Error('Este grupo tiene clases asociadas. Elimínalas antes.');
    }
    Papelera.papelearGrupo_(ss, claseId); // a la papelera antes de borrar
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    sh.deleteRow(fila);
    return { ok: true };
  }

  /**
   * Elimina el grupo Y todas sus clases (evaluaciones) en cascada. Cada clase
   * pasa por la papelera (con sus unidades y notas), y el grupo también: todo
   * es restaurable un tiempo.
   */
  function eliminarConTodo_(ss, claseId) {
    Evaluaciones.idsDeClase_(ss, claseId).forEach(function (evalId) {
      Evaluaciones.eliminar_(ss, evalId);
    });
    return eliminar_(ss, claseId);
  }

  /** Marca (si=true) o desmarca el grupo como archivado (col 11). */
  function archivar_(ss, claseId, si) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, claseId);
    if (fila < 0) throw new Error('Clase no encontrada.');
    sh.getRange(fila, 11).setValue(si ? 1 : '');
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
    var a = parse_(json); return a.length; // solo cuenta, no necesita descifrar
  }

  /** Serializa el alumnado cifrando los nombres (LOPD: ilegibles en la hoja). */
  function serializar_(alumnos) {
    return JSON.stringify((alumnos || []).map(function (a) {
      return { id: a.id, nombre: Cripto.cifrar(a.nombre) };
    }));
  }
  /** Lee el alumnado descifrando los nombres (admite texto plano de antes). */
  function deserializar_(json) {
    return parse_(json).map(function (a) {
      return { id: a.id, nombre: Cripto.descifrar(a.nombre) };
    });
  }
  function validar_(v, que) {
    if (!v || !String(v).trim()) throw new Error('Falta ' + que + '.');
  }

  return {
    listar_: listar_, crear_: crear_, obtener_: obtener_, editar_: editar_,
    actualizarAlumnos_: actualizarAlumnos_,
    eliminar_: eliminar_, eliminarConTodo_: eliminarConTodo_,
    archivar_: archivar_, reordenar_: reordenar_
  };
})();
