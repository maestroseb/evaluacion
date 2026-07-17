/**
 * Calendario de cada curso académico: fecha de inicio y fin del curso y los
 * festivos (días no lectivos). Lo edita el profe desde el planificador y sirve
 * para sugerir fechas saltando findes y festivos y para señalar los días no
 * lectivos en las vistas.
 *
 * Una fila por curso académico (p. ej. "2025-2026"). 'festivos' es un JSON
 * [{desde, hasta, nombre}]: un festivo de un solo día lleva desde == hasta.
 */

/** Calendario del curso académico dado (vacío si aún no se ha configurado). */
function getCalendario(cursoAcademico) {
  return Calendario.obtener_(abrirCuaderno_(), cursoAcademico);
}

/** Guarda el calendario de un curso académico. payload: {inicio, fin, festivos:[{desde,hasta,nombre}]} */
function guardarCalendario(cursoAcademico, payload) {
  return Calendario.guardar_(abrirCuaderno_(), cursoAcademico, payload);
}

var Calendario = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.CALENDARIO); }

  function obtener_(ss, curso) {
    curso = String(curso || '').trim();
    var datos = hoja_(ss).getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === curso) {
        return { cursoAcademico: curso, inicio: aFechaStr_(datos[i][1]), fin: aFechaStr_(datos[i][2]),
          festivos: parse_(datos[i][3]).map(function (f) {
            return { desde: aFechaStr_(f && f.desde), hasta: aFechaStr_(f && f.hasta),
              nombre: (f && f.nombre) || '' };
          }) };
      }
    }
    return { cursoAcademico: curso, inicio: '', fin: '', festivos: [] };
  }

  function guardar_(ss, curso, payload) {
    curso = String(curso || '').trim();
    if (!curso) throw new Error('Falta el curso académico.');
    var inicio = fecha_(payload && payload.inicio);
    var fin = fecha_(payload && payload.fin);
    if (inicio && fin && fin < inicio) throw new Error('El fin del curso es anterior al inicio.');
    var festivos = (Array.isArray(payload && payload.festivos) ? payload.festivos : [])
      .map(function (f) {
        var d1 = fecha_(f && f.desde), d2 = fecha_(f && f.hasta) || d1;
        return { desde: d1, hasta: (d2 && d2 >= d1 ? d2 : d1), nombre: String((f && f.nombre) || '').slice(0, 80) };
      })
      .filter(function (f) { return f.desde; })
      // Orden cronológico, se añadan cuando se añadan.
      .sort(function (a, b) { return a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0; });
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, curso); // col 1 = cursoAcademico (hace de id)
    var vals = [curso, inicio, fin, JSON.stringify(festivos)];
    if (fila < 0) sh.appendRow(vals);
    else sh.getRange(fila, 1, 1, 4).setValues([vals]);
    return obtener_(ss, curso);
  }

  function fecha_(v) {
    var s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  /**
   * Normaliza a 'YYYY-MM-DD'. Al escribir 'YYYY-MM-DD' con setValues, Sheets
   * convierte la celda en una fecha real, así que al releer llega un objeto Date
   * (que serializado a JSON sería un ISO con hora y zona, ilegible para
   * <input type=date>). Lo reconvertimos a texto con la zona del script.
   */
  function aFechaStr_(v) {
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return fecha_(v);
  }
  function parse_(j) {
    if (!j) return [];
    try { var v = JSON.parse(j); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  return { obtener_: obtener_, guardar_: guardar_ };
})();
