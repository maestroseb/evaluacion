/**
 * Importación desde Google Classroom.
 *
 * En g.educaand.es los cursos de Classroom se exportan desde Séneca, así que
 * el nombre del alumnado ya suele venir en el formato «Apellidos, Nombre» que
 * usa la app. Aun así reconstruimos el nombre desde los campos estructurados
 * (familyName / givenName) para dejarlo siempre en ese orden, y la lista se
 * vuelca en el cuadro editable del modal para una revisión final.
 *
 * Requiere el servicio avanzado «Classroom» y los scopes
 * classroom.courses.readonly y classroom.rosters.readonly (solo lectura).
 *
 * Funciones públicas (sin guion bajo) = invocables desde el frontend.
 */

/** Cursos de Classroom donde el profe es docente (activos), para el desplegable. */
function listarCursosClassroom() {
  return ClassroomImp.listarCursos_();
}

/** Alumnado de un curso de Classroom, en formato «Apellidos, Nombre». */
function alumnosCursoClassroom(courseId) {
  return ClassroomImp.alumnos_(courseId);
}

var ClassroomImp = (function () {

  /** ¿Está disponible el servicio avanzado de Classroom en este despliegue? */
  function disponible_() {
    return (typeof Classroom !== 'undefined') && Classroom && Classroom.Courses;
  }

  function listarCursos_() {
    if (!disponible_()) return { ok: false, error: 'Classroom no está disponible.' };
    try {
      var out = [], pageToken = null;
      do {
        var r = Classroom.Courses.list({
          teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken: pageToken
        });
        (r.courses || []).forEach(function (c) {
          out.push({ id: c.id, nombre: c.name || '(sin nombre)',
            seccion: c.section || '' });
        });
        pageToken = r.nextPageToken;
      } while (pageToken);
      // Alfabético para que sea fácil localizar el curso.
      out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
      return { ok: true, cursos: out };
    } catch (e) {
      return { ok: false, error: errTexto_(e) };
    }
  }

  function alumnos_(courseId) {
    if (!disponible_()) return { ok: false, error: 'Classroom no está disponible.' };
    if (!courseId) return { ok: false, error: 'Falta el curso.' };
    try {
      var nombres = [], pageToken = null;
      do {
        var r = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: pageToken });
        (r.students || []).forEach(function (s) {
          var n = nombreSeneca_(s.profile && s.profile.name);
          if (n) nombres.push(n);
        });
        pageToken = r.nextPageToken;
      } while (pageToken);
      // Orden alfabético por «Apellidos, Nombre» (locale español).
      nombres.sort(function (a, b) { return a.localeCompare(b, 'es'); });
      return { ok: true, alumnos: nombres };
    } catch (e) {
      return { ok: false, error: errTexto_(e) };
    }
  }

  /**
   * Nombre en «Apellidos, Nombre» a partir del Name de Classroom. Prefiere los
   * campos estructurados (familyName / givenName); si no los hay, usa fullName
   * tal cual (en g.educaand suele venir ya de Séneca en el orden correcto).
   */
  function nombreSeneca_(name) {
    if (!name) return '';
    var ap = (name.familyName || '').trim();
    var no = (name.givenName || '').trim();
    if (ap && no) return ap + ', ' + no;
    return (name.fullName || ap || no || '').trim();
  }

  function errTexto_(e) {
    var m = (e && e.message) || String(e);
    // Mensaje amable ante el error típico de permiso/servicio no habilitado.
    if (/PERMISSION|insufficient|not been used|Classroom API|403/i.test(m)) {
      return 'No se pudo acceder a Classroom (permiso o servicio). Vuelve a ' +
        'autorizar la app al entrar.';
    }
    return m;
  }

  return { listarCursos_: listarCursos_, alumnos_: alumnos_ };
})();
