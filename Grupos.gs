/**
 * Fase 2 — Gestión de grupos y alumnado.
 *
 * Un "grupo" es una clase del profe: tiene nombre, un área+curso del Mapa
 * Curricular (que fija sus criterios) y una lista de alumnos/as.
 *
 * Todo se guarda en la pestaña _grupos del cuaderno personal. El alumnado va
 * serializado como JSON en la columna "alumnos": [{id, nombre}].
 *
 * Las funciones públicas (sin guion bajo) son las que invoca el frontend con
 * google.script.run.
 */

/** Devuelve los criterios de un área+curso para mostrarlos al crear el grupo. */
function getCriterios(curso, area) {
  return Curriculo.criteriosDe(curso, area);
}

/** Crea un grupo nuevo. payload: {nombre, area, curso, alumnos:[{nombre}]} */
function crearGrupo(payload) {
  var ss = abrirCuaderno_();
  return Grupos.crear_(ss, payload);
}

/** Devuelve un grupo completo, incluido su alumnado. */
function obtenerGrupo(grupoId) {
  var ss = abrirCuaderno_();
  return Grupos.obtener_(ss, grupoId);
}

/** Reemplaza la lista de alumnos de un grupo. alumnos: [{id?, nombre}] */
function actualizarAlumnos(grupoId, alumnos) {
  var ss = abrirCuaderno_();
  return Grupos.actualizarAlumnos_(ss, grupoId, alumnos);
}

/** Renombra un grupo. */
function renombrarGrupo(grupoId, nombre) {
  var ss = abrirCuaderno_();
  return Grupos.renombrar_(ss, grupoId, nombre);
}

/** Elimina un grupo (y deja huérfanas sus unidades, que se limpian en Fase 3). */
function eliminarGrupo(grupoId) {
  var ss = abrirCuaderno_();
  return Grupos.eliminar_(ss, grupoId);
}


var Grupos = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.GRUPOS); }

  /** Localiza la fila (1-based) de un grupo por su id, o -1. */
  function filaDe_(sh, grupoId) {
    var ids = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === grupoId) return i + 2;
    }
    return -1;
  }

  function crear_(ss, payload) {
    validarTexto_(payload && payload.nombre, 'el nombre del grupo');
    validarTexto_(payload.area, 'el área');
    validarTexto_(payload.curso, 'el curso');

    var grupoId = 'g_' + Utilities.getUuid().slice(0, 8);
    var alumnos = normalizarAlumnos_(payload.alumnos || []);
    var sh = hoja_(ss);
    // Columnas: grupoId, nombre, area, curso, creado, alumnos(JSON)
    sh.appendRow([
      grupoId,
      payload.nombre.trim(),
      payload.area,
      payload.curso,
      new Date().toISOString(),
      JSON.stringify(alumnos)
    ]);
    return obtener_(ss, grupoId);
  }

  function obtener_(ss, grupoId) {
    var sh = hoja_(ss);
    var fila = filaDe_(sh, grupoId);
    if (fila < 0) throw new Error('Grupo no encontrado.');
    var f = sh.getRange(fila, 1, 1, 6).getValues()[0];
    return {
      grupoId: f[0],
      nombre: f[1],
      area: f[2],
      curso: f[3],
      creado: f[4],
      alumnos: parseAlumnos_(f[5])
    };
  }

  function actualizarAlumnos_(ss, grupoId, alumnos) {
    var sh = hoja_(ss);
    var fila = filaDe_(sh, grupoId);
    if (fila < 0) throw new Error('Grupo no encontrado.');
    var norm = normalizarAlumnos_(alumnos);
    sh.getRange(fila, 6).setValue(JSON.stringify(norm));
    return obtener_(ss, grupoId);
  }

  function renombrar_(ss, grupoId, nombre) {
    validarTexto_(nombre, 'el nombre del grupo');
    var sh = hoja_(ss);
    var fila = filaDe_(sh, grupoId);
    if (fila < 0) throw new Error('Grupo no encontrado.');
    sh.getRange(fila, 2).setValue(nombre.trim());
    return obtener_(ss, grupoId);
  }

  function eliminar_(ss, grupoId) {
    var sh = hoja_(ss);
    var fila = filaDe_(sh, grupoId);
    if (fila < 0) throw new Error('Grupo no encontrado.');
    sh.deleteRow(fila);
    return { ok: true };
  }

  /**
   * Garantiza ids estables para cada alumno y conserva los existentes.
   * Entrada: [{id?, nombre}]. Salida: [{id, nombre}] sin vacíos ni duplicados.
   */
  function normalizarAlumnos_(lista) {
    var out = [];
    var vistos = {};
    (lista || []).forEach(function (a) {
      var nombre = String((a && a.nombre) || '').trim();
      if (!nombre) return;
      var id = (a && a.id) || ('a_' + Utilities.getUuid().slice(0, 8));
      if (vistos[id]) id = 'a_' + Utilities.getUuid().slice(0, 8);
      vistos[id] = true;
      out.push({ id: id, nombre: nombre });
    });
    return out;
  }

  function parseAlumnos_(json) {
    if (!json) return [];
    try { return JSON.parse(json); } catch (e) { return []; }
  }

  function validarTexto_(v, que) {
    if (!v || !String(v).trim()) throw new Error('Falta ' + que + '.');
  }

  return {
    crear_: crear_,
    obtener_: obtener_,
    actualizarAlumnos_: actualizarAlumnos_,
    renombrar_: renombrar_,
    eliminar_: eliminar_
  };
})();
