/**
 * Fase 4 — Resumen global de una clase (evaluación).
 *
 * Agrega todas las unidades:
 *   - nota de cada criterio en cada unidad = media de las actividades de ese
 *     criterio en la unidad (ítems/nºítems*10);
 *   - nota global de un criterio = media de sus notas de unidad (solo en las
 *     unidades donde se evaluó);
 *   - nota de cada unidad = media de sus notas de criterio;
 *   - nota final = media de las notas globales de criterio.
 */

function getResumen(evalId) {
  return Resumen.calcular_(abrirCuaderno_(), evalId);
}

var Resumen = (function () {

  function calcular_(ss, evalId) {
    var ev = Evaluaciones.obtener_(ss, evalId);
    var alumnos = ev.clase.alumnos;
    var unidades = Unidades.listar_(ss, evalId);

    var criteriosInfo = {};
    Curriculo.criteriosDe(ev.curso, ev.area).forEach(function (c) {
      criteriosInfo[c.codigo] = { texto: c.texto, descripcion: c.descripcion };
    });

    var items = leerItems_(ss); // map[actividadId][alumnoId] = conseguidos

    // Estructuras de salida.
    var critGlobal = {};   // alId -> {cod -> nota}
    var unidadNota = {};    // alId -> {unidadId -> nota}
    var finalNota = {};     // alId -> nota
    var critsUsados = {};   // set de criterios evaluados en alguna unidad

    // Acumulador: alId -> cod -> [notas de unidad]
    var acumCrit = {};
    alumnos.forEach(function (al) {
      acumCrit[al.id] = {}; unidadNota[al.id] = {};
    });

    unidades.forEach(function (u) {
      var acts = Actividades.listar_(ss, u.unidadId);
      alumnos.forEach(function (al) {
        var porCrit = {}; // cod -> [notas de actividad en esta unidad]
        acts.forEach(function (a) {
          var n = notaActividad_(items, a, al.id);
          if (n == null) return;
          a.criterios.forEach(function (cod) {
            (porCrit[cod] || (porCrit[cod] = [])).push(n);
          });
        });
        var notasCritUnidad = [];
        Object.keys(porCrit).forEach(function (cod) {
          critsUsados[cod] = true;
          var nc = media_(porCrit[cod]);
          (acumCrit[al.id][cod] || (acumCrit[al.id][cod] = [])).push(nc);
          notasCritUnidad.push(nc);
        });
        if (notasCritUnidad.length) unidadNota[al.id][u.unidadId] = media_(notasCritUnidad);
      });
    });

    // Global por criterio y nota final.
    alumnos.forEach(function (al) {
      critGlobal[al.id] = {};
      var globales = [];
      Object.keys(acumCrit[al.id]).forEach(function (cod) {
        var g = media_(acumCrit[al.id][cod]);
        critGlobal[al.id][cod] = g;
        globales.push(g);
      });
      finalNota[al.id] = globales.length ? media_(globales) : null;
    });

    return {
      area: ev.area, curso: ev.curso, color: ev.color || '',
      claseNombre: ev.clase.nombre,
      alumnos: alumnos,
      unidades: unidades.map(function (u) { return { unidadId: u.unidadId, nombre: u.nombre }; }),
      criterios: Object.keys(critsUsados).sort(cmpCodigo_),
      criteriosInfo: criteriosInfo,
      unidadNota: unidadNota,
      critGlobal: critGlobal,
      final: finalNota
    };
  }

  // --- helpers ---
  function leerItems_(ss) {
    var datos = ss.getSheetByName(HOJAS.ITEMS).getDataRange().getValues();
    var m = {};
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      (m[f[0]] || (m[f[0]] = {}))[f[1]] = Number(f[2]);
    }
    return m;
  }
  function notaActividad_(items, act, alId) {
    var fila = items[act.actividadId];
    var c = fila && fila[alId] != null ? fila[alId] : null;
    if (c == null || !(act.numItems > 0)) return null;
    return Math.max(0, Math.min(10, c / act.numItems * 10));
  }
  function media_(arr) {
    if (!arr || !arr.length) return null;
    var s = arr.reduce(function (a, b) { return a + b; }, 0);
    return s / arr.length;
  }
  function cmpCodigo_(a, b) {
    var pa = a.split('.'), pb = b.split('.');
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var na = parseInt(pa[i], 10), nb = parseInt(pb[i], 10);
      if (isNaN(na) || isNaN(nb)) {
        if ((pa[i] || '') !== (pb[i] || '')) return (pa[i] || '') < (pb[i] || '') ? -1 : 1;
      } else if (na !== nb) return na - nb;
    }
    return 0;
  }

  return { calcular_: calcular_ };
})();
