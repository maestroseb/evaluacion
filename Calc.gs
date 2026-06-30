/**
 * Motor de cálculo. Porta la lógica de tu hoja actual:
 *
 *   nota_actividad(alumno) = items_conseguidos / num_items * 10
 *
 *   Si varias actividades comparten un mismo criterio y se marcan como
 *   "agrupadas", sus ítems se SUMAN y cuentan como una sola actividad:
 *       nota = (Σ conseguidos) / (Σ num_items) * 10
 *
 *   nota_criterio(alumno) = media de las notas de las actividades de ese
 *                           criterio (respetando las agrupaciones).
 *
 *   nota_unidad(alumno)   = media de las notas de criterio de la unidad.
 *   nota_final(alumno)    = media de las notas de criterio en las unidades
 *                           seleccionadas (resumen global).
 *
 * Esta lógica vive centralizada: corregir aquí arregla a todos los profes.
 */
var Calc = (function () {

  /** Nota 0–10 de una actividad para un alumno. */
  function notaActividad(conseguidos, numItems) {
    if (!numItems || numItems <= 0) return null;
    var n = conseguidos / numItems * 10;
    return Math.max(0, Math.min(10, redondear_(n)));
  }

  /**
   * Nota de un criterio a partir de sus actividades.
   * @param {Array} actividades  [{conseguidos, numItems, grupo}]
   *   actividades con el mismo "grupo" (string) se suman antes de promediar.
   * @return {number|null}
   */
  function notaCriterio(actividades) {
    var agrupadas = {};
    var sueltas = [];

    actividades.forEach(function (a) {
      if (a.grupo) {
        var g = agrupadas[a.grupo] || (agrupadas[a.grupo] = { c: 0, n: 0 });
        g.c += Number(a.conseguidos) || 0;
        g.n += Number(a.numItems) || 0;
      } else {
        sueltas.push(notaActividad(a.conseguidos, a.numItems));
      }
    });

    var notas = sueltas.filter(esNumero_);
    Object.keys(agrupadas).forEach(function (k) {
      var g = agrupadas[k];
      var n = notaActividad(g.c, g.n);
      if (esNumero_(n)) notas.push(n);
    });

    return media_(notas);
  }

  /** Media de un conjunto de notas de criterio (unidad o resumen global). */
  function media(notas) {
    return media_(notas.filter(esNumero_));
  }

  // --- helpers ---
  function media_(arr) {
    if (!arr.length) return null;
    var s = arr.reduce(function (a, b) { return a + b; }, 0);
    return redondear_(s / arr.length);
  }
  function redondear_(n) { return Math.round(n * 100) / 100; }
  function esNumero_(n) { return typeof n === 'number' && !isNaN(n); }

  return {
    notaActividad: notaActividad,
    notaCriterio: notaCriterio,
    media: media
  };
})();
