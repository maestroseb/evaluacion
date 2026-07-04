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

    // Lectura única de _actividades y _notas (indexadas por unidadId): el coste
    // ya no crece con el número de unidades (antes: 2 lecturas por unidad).
    var actsPorUnidad = Actividades.porUnidad_(ss);
    var notasPorUnidad = Notas.todas_(ss);

    // Definiciones de las rúbricas usadas por columnas de tipo "rubrica".
    var rubricas = {};
    Object.keys(actsPorUnidad).forEach(function (u) {
      actsPorUnidad[u].forEach(function (a) {
        if (a.tipo === 'rubrica' && a.rubricaId && !rubricas[a.rubricaId]) {
          try { rubricas[a.rubricaId] = Rubricas.obtener_(ss, a.rubricaId); } catch (e) {}
        }
      });
    });

    // Notas de todas las unidades de esta evaluación (blobs por unidad).
    var items = {}; // map[actividadId][alumnoId] = conseguidos
    unidades.forEach(function (u) {
      var blob = notasPorUnidad[u.unidadId] || {};
      Object.keys(blob).forEach(function (actId) { items[actId] = blob[actId]; });
    });

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
      var acts = actsPorUnidad[u.unidadId] || [];
      alumnos.forEach(function (al) {
        var porCrit = {}; // cod -> [notas de actividad en esta unidad]
        acts.forEach(function (a) {
          // Por criterio: con desglose cada criterio recibe SU valor; sin él,
          // todos comparten la misma nota de la actividad.
          a.criterios.forEach(function (cod) {
            var n = notaActividad_(items, rubricas, a, al.id, cod);
            if (n == null) return;
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
  // Equivalencias 0-10 de las escalas (espejo del catálogo TIPOS_ACT del
  // cliente; el blob guarda el Nº DE NIVEL 1-5).
  var NOTAS_ESCALA = {
    escala:    [2.5, 5, 6, 7.5, 9.5],  // IN, SU, BI, NT, SB
    escalaInf: [2, 4, 6, 8, 10]        // POC, REG, ADE, BUE, EXC (rúbrica /5)
  };

  /**
   * Nota 0-10 de una actividad según su tipo (espejo del cliente). Con
   * desglose por criterio, `cod` selecciona el valor de ESE criterio dentro
   * del objeto {codigo: valor}.
   */
  function notaActividad_(items, rubricas, act, alId, cod) {
    var fila = items[act.actividadId];
    var v = fila && fila[alId] != null ? fila[alId] : null;
    // Rúbrica: el valor es la selección {indice: nivel}; se calcula /10 con la
    // definición de la rúbrica (global o por indicador según rubMap).
    if ((act.tipo || 'items') === 'rubrica') {
      var def = rubricas && rubricas[act.rubricaId];
      if (!def || v == null || typeof v !== 'object') return null;
      return notaRubricaCrit_(def, act, v, cod);
    }
    // Desglose: el valor es un objeto {codigo: valor}; sin desglose, un objeto
    // sería un resto de un cambio de configuración y no puntúa.
    if (v != null && typeof v === 'object') {
      v = (act.desglose && cod != null && v[cod] != null) ? v[cod] : null;
    }
    if (v == null) return null;
    // Cadenas = observaciones (o restos de un cambio de tipo): nunca puntúan.
    if (typeof v === 'string') return null;
    switch (act.tipo || 'items') {
      case 'nota':  return Math.max(0, Math.min(10, v));
      case 'check': return v ? 10 : 0;
      case 'texto': return null; // observación: nunca puntúa
      case 'escala': case 'escalaInf':
        var eq = NOTAS_ESCALA[act.tipo][Math.round(v) - 1];
        return eq == null ? null : eq;
      default: // items y contador con máximo: proporción sobre numItems
        if (!(act.numItems > 0)) return null;
        return Math.max(0, Math.min(10, v / act.numItems * 10));
    }
  }
  // --- rúbrica: trasvase de la selección {indice: nivel} a nota /10 (espejo del cliente) ---
  function rubMax_(def) {
    var m = 0;
    (def.niveles || []).forEach(function (n) { var v = Number(n.valor) || 0; if (v > m) m = v; });
    return m;
  }
  function notaRub_(def, picks, filtro) {
    var maxP = rubMax_(def);
    if (!(maxP > 0)) return null;
    var niveles = def.niveles || [], sumW = 0, sum = 0;
    (def.indicadores || []).forEach(function (ind, i) {
      if (filtro && !filtro(i)) return;
      var lvl = picks[i];
      if (lvl == null) return;
      var niv = niveles[Math.round(lvl) - 1];
      if (!niv) return;
      var w = Number(ind.peso) || 0;
      sum += (Number(niv.valor) || 0) / maxP * w;
      sumW += w;
    });
    return sumW > 0 ? (sum / sumW) * 10 : null;
  }
  function notaRubricaCrit_(def, act, picks, cod) {
    var mapa = act.rubMap || [];
    if (mapa.length) return notaRub_(def, picks, function (i) { return (mapa[i] || '') === cod; });
    return notaRub_(def, picks, null);
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
