/**
 * Cursos académicos (p. ej. "2024-2025").
 *
 * Un solo cuaderno guarda TODOS los cursos: cada grupo (_clases) y cada clase
 * (_evaluaciones) lleva su campo `cursoAcademico`, y la interfaz filtra por el
 * curso activo (guardado en las propiedades del usuario). Así el cuaderno no se
 * multiplica en ficheros ni pestañas: lo único que crece con los años son unas
 * pocas filas más, que se escanean en milisegundos.
 */

/**
 * Cambia el curso activo y devuelve ya los datos filtrados de ese curso, para
 * repintar Clases y Grupos sin recargar toda la aplicación.
 */
function cambiarCurso(curso) {
  var ss = abrirCuaderno_();
  Cursos.fijar_(curso);
  var clases = Clases.listar_(ss); // una sola lectura de _clases para todo
  return {
    cursos: Cursos.info_(ss, clases),
    clases: Cursos.filtrar_(clases, curso),
    evaluaciones: Cursos.filtrar_(Evaluaciones.listar_(ss, clases), curso)
  };
}

/**
 * Crea o edita un curso académico (nombre, centro, config). payload:
 *   { id?, anio, nombre, centro, config }
 * Sin `id` = curso NUEVO (id opaco, p. ej. un interino con un 2º centro el
 * mismo año); queda activo. Con `id` = editar ese curso en su sitio
 * (materializa el curso-año la 1ª vez sin cambiar su clave, así los grupos
 * existentes siguen enganchados). Devuelve el estado del curso ya activo.
 */
function guardarCurso(payload) {
  payload = payload || {};
  var ss = abrirCuaderno_();
  var id = Cursos.guardar_(ss, payload);
  Cursos.fijar_(id);
  // El calendario del curso (inicio/fin/festivos) vive en su propia pestaña,
  // con la misma clave (cursoId). Se guarda aquí para que todo el curso —datos
  // y calendario— se edite desde un único panel.
  var cal = payload.calendario
    ? Calendario.guardar_(ss, id, payload.calendario)
    : Calendario.obtener_(ss, id);
  var clases = Clases.listar_(ss);
  return {
    cursos: Cursos.info_(ss, clases),
    clases: Cursos.filtrar_(clases, id),
    evaluaciones: Cursos.filtrar_(Evaluaciones.listar_(ss, clases), id),
    calendario: cal
  };
}


var Cursos = (function () {

  /** Curso académico natural según la fecha: de septiembre a agosto. */
  function actual_() {
    var d = new Date();
    var y = d.getFullYear();
    // getMonth() es 0-based: 8 = septiembre.
    return (d.getMonth() >= 8) ? (y + '-' + (y + 1)) : ((y - 1) + '-' + y);
  }

  /** Curso activo guardado; si no hay ninguno, el natural del calendario. */
  function activo_() {
    var p = PropertiesService.getUserProperties().getProperty('cursoActivo');
    return p || actual_();
  }

  function fijar_(curso) {
    if (!curso || !String(curso).trim()) throw new Error('Falta el curso académico.');
    PropertiesService.getUserProperties().setProperty('cursoActivo', String(curso).trim());
    return activo_();
  }

  /** Un año "YYYY-YYYY" hace de su propio id cuando el curso no está materializado. */
  function esAnio_(v) { return /^\d{4}-\d{4}$/.test(String(v || '')); }

  function parseConfig_(j) {
    if (!j) return {};
    try { var v = JSON.parse(j); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
  }

  /** Filas de _cursos indexadas por cursoId: { id: {id, anio, nombre, centro, config, orden} }. */
  function materializados_(ss) {
    var sh = ss.getSheetByName(HOJAS.CURSOS);
    var out = {};
    if (!sh || sh.getLastRow() < 2) return out;
    var datos = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
    datos.forEach(function (f) {
      var id = String(f[0] || '').trim();
      if (!id) return;
      out[id] = {
        id: id,
        anio: String(f[1] || '').trim() || (esAnio_(id) ? id : ''),
        nombre: String(f[2] || '').trim(),
        centro: String(f[3] || '').trim(),
        config: parseConfig_(f[4]),
        orden: Number(f[5]) || 0
      };
    });
    return out;
  }

  /** Ficha (objeto) de un curso por su id, esté materializado o sea un curso-año. */
  function ficha_(id, mat) {
    id = String(id || '').trim();
    if (mat[id]) return mat[id];
    return { id: id, anio: esAnio_(id) ? id : '', nombre: '', centro: '', config: {}, orden: 0 };
  }

  /**
   * Todos los cursos como objetos, recientes primero: los presentes en los
   * grupos + los materializados en _cursos + el activo + el año natural.
   * Cada uno: { id, anio, nombre, centro, config }.
   */
  function lista_(ss, clasesLista) {
    var mat = materializados_(ss);
    var ids = {};
    (clasesLista || Clases.listar_(ss)).forEach(function (c) {
      if (c.cursoAcademico) ids[c.cursoAcademico] = 1;
    });
    Object.keys(mat).forEach(function (id) { ids[id] = 1; });
    ids[actual_()] = 1;
    ids[activo_()] = 1;
    return Object.keys(ids).map(function (id) { return ficha_(id, mat); }).sort(function (a, b) {
      // Año descendente (recientes primero); a igualdad, por nombre/centro.
      if (a.anio !== b.anio) return a.anio < b.anio ? 1 : -1;
      var na = a.nombre || a.centro, nb = b.nombre || b.centro;
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  }

  function info_(ss, clasesLista) {
    return { activo: activo_(), actual: actual_(), lista: lista_(ss, clasesLista) };
  }

  /**
   * Crea (sin id) o actualiza (con id) un curso y devuelve su id. Al crear,
   * el id es opaco; al editar un curso-año por primera vez, se materializa con
   * cursoId = su propio año (la clave no cambia y los grupos siguen enganchados).
   */
  function guardar_(ss, payload) {
    var id = String(payload.id || '').trim();
    var creando = !id;
    if (creando) id = Datos.nuevoId_('curso');

    var anio = String(payload.anio || '').trim();
    if (!esAnio_(anio)) anio = esAnio_(id) ? id : actual_();
    var nombre = String(payload.nombre || '').trim().slice(0, 80);
    var centro = String(payload.centro || '').trim().slice(0, 80);
    var config = (payload.config && typeof payload.config === 'object') ? payload.config : {};

    var sh = ss.getSheetByName(HOJAS.CURSOS);
    var fila = Datos.filaDeId_(sh, id); // col 1 = cursoId
    if (fila < 0) {
      var mat = materializados_(ss);
      var orden = Datos.siguienteOrden_(Object.keys(mat).map(function (k) { return mat[k]; }));
      sh.appendRow([id, anio, nombre, centro, JSON.stringify(config), orden, new Date().toISOString()]);
    } else {
      // Conserva orden y creado (col 6-7); reescribe id..config (col 1-5).
      sh.getRange(fila, 1, 1, 5).setValues([[id, anio, nombre, centro, JSON.stringify(config)]]);
    }
    return id;
  }

  /** Filtra una lista (con campo cursoAcademico) al curso dado; vacío = natural. */
  function filtrar_(filas, curso) {
    var nat = actual_();
    return (filas || []).filter(function (x) {
      return (x.cursoAcademico || nat) === curso;
    });
  }

  /**
   * Asigna cursoAcademico = curso natural a las filas antiguas que lo tengan
   * vacío (una sola pasada, idempotente). No toca las que ya tienen valor, así
   * que es seguro llamarla en cada arranque. Col 9 en _clases y _evaluaciones.
   */
  function backfill_(ss) {
    // Solo hace falta una vez por usuario: las filas nuevas ya nacen con
    // cursoAcademico. Un flag evita releer dos hojas en cada arranque.
    var props = PropertiesService.getUserProperties();
    if (props.getProperty('backfillCursos') === '1') return;
    var curso = actual_();
    [HOJAS.CLASES, HOJAS.EVALUACIONES].forEach(function (nombre) {
      var sh = ss.getSheetByName(nombre);
      if (!sh || sh.getLastRow() < 2) return;
      var n = sh.getLastRow() - 1;
      var ids = sh.getRange(2, 1, n, 1).getValues();
      var cursos = sh.getRange(2, 9, n, 1).getValues();
      var cambios = false;
      for (var i = 0; i < n; i++) {
        if (ids[i][0] && (cursos[i][0] === '' || cursos[i][0] == null)) {
          cursos[i][0] = curso; cambios = true;
        }
      }
      if (cambios) sh.getRange(2, 9, n, 1).setValues(cursos);
    });
    props.setProperty('backfillCursos', '1');
  }

  /**
   * Invalida el flag del backfill. Hay que llamarla cuando entren filas que
   * pueden venir sin cursoAcademico (importar una copia antigua, restaurar de
   * la papelera): el siguiente arranque volverá a estamparlas.
   */
  function invalidarBackfill_() {
    PropertiesService.getUserProperties().deleteProperty('backfillCursos');
  }

  return {
    actual_: actual_, activo_: activo_, fijar_: fijar_,
    info_: info_, filtrar_: filtrar_, backfill_: backfill_,
    invalidarBackfill_: invalidarBackfill_,
    guardar_: guardar_, materializados_: materializados_
  };
})();
