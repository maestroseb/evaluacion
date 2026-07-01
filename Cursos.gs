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

  /** Cursos presentes en los grupos + el activo + el natural, recientes primero. */
  function lista_(ss, clasesLista) {
    var set = {};
    (clasesLista || Clases.listar_(ss)).forEach(function (c) {
      if (c.cursoAcademico) set[c.cursoAcademico] = 1;
    });
    set[actual_()] = 1;
    set[activo_()] = 1;
    return Object.keys(set).sort().reverse();
  }

  function info_(ss, clasesLista) {
    return { activo: activo_(), actual: actual_(), lista: lista_(ss, clasesLista) };
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

  return {
    actual_: actual_, activo_: activo_, fijar_: fijar_,
    info_: info_, filtrar_: filtrar_, backfill_: backfill_
  };
})();
