/**
 * Criterios propios del profe (pensado para FP: Resultados de Aprendizaje y
 * sus criterios, con ponderaciones del centro; sirve para cualquier enseñanza
 * que no esté en el mapa central).
 *
 * Pestaña _mapaPropio del cuaderno: mismas columnas conceptuales que el mapa
 * central (curso | area | competencia | codigo | texto) más dos pesos
 * opcionales. En FP: area = módulo profesional, competencia = RA.
 * Los pesos se GUARDAN desde ya, aunque el motor de notas aún no los aplique
 * (llegarán con la fase de cálculo ponderado).
 *
 * Las filas propias se FUSIONAN con el mapa central al listar áreas y
 * criterios: para el resto de la app son criterios normales.
 */
var MapaPropio = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.MAPA_PROPIO); }

  /** Filas propias con el mismo formato que las del mapa central. */
  function filas_(ss) {
    var sh = hoja_(ss);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues()
      .filter(function (f) { return f[0] && f[4]; })
      .map(function (f) {
        return {
          curso: String(f[0]).trim(), area: String(f[1]).trim(),
          competencia: String(f[2]).trim(),
          pesoRA: f[3] === '' || f[3] == null ? '' : Number(f[3]),
          codigo: String(f[4]).trim(), texto: String(f[5]).trim(),
          pesoCriterio: f[6] === '' || f[6] == null ? '' : Number(f[6]),
          descripcion: '', propio: true
        };
      });
  }

  /** Resumen por bloque curso+área: nº de RA y de criterios. */
  function resumen_(ss) {
    var bloques = {};
    filas_(ss).forEach(function (f) {
      var k = f.curso + '||' + f.area;
      var b = bloques[k] || (bloques[k] = { curso: f.curso, area: f.area, ras: {}, criterios: 0 });
      if (f.competencia) b.ras[f.competencia] = 1;
      b.criterios++;
    });
    return Object.keys(bloques).sort().map(function (k) {
      var b = bloques[k];
      return { curso: b.curso, area: b.area, numRA: Object.keys(b.ras).length, numCriterios: b.criterios };
    });
  }

  /**
   * Importa filas pegadas desde una hoja de cálculo (separadas por tabulador;
   * también acepta ';'). Columnas esperadas, con o sin fila de cabecera:
   *   curso | área | RA/competencia | peso RA | código | texto | peso criterio
   * Reemplaza los bloques curso+área que vengan en el texto (reimportar no
   * duplica) y conserva el resto.
   */
  /**
   * Ordena las columnas pegadas a [curso, área, RA, pesoRA, código, texto,
   * pesoCriterio] según cuántas haya, para que valga tanto FP como criterios
   * «estilo Primaria» (sin RA ni pesos):
   *   7+ → completo (FP);  5-6 → curso|área|RA|código|texto;  ≤4 → curso|área|código|texto.
   */
  function mapear_(c) {
    if (c.length >= 7) return [c[0], c[1], c[2], c[3], c[4], c[5], c[6]];
    if (c.length >= 5) return [c[0], c[1], c[2], '', c[3], c[4], ''];
    return [c[0], c[1], '', '', c[2], c[3], ''];
  }

  function importar_(ss, texto) {
    var filasNuevas = [], descartadas = [];
    String(texto || '').split(/\r?\n/).forEach(function (linea, i) {
      if (!linea.trim()) return;
      var c = linea.split(linea.indexOf('\t') >= 0 ? '\t' : ';').map(function (x) { return String(x).trim(); });
      // Cabecera: la saltamos si huele a nombres de columna.
      if (i === 0 && /curso/i.test(c[0] || '') && /c(ó|o)digo/i.test(linea)) return;
      var r = mapear_(c); // [curso, área, RA, pesoRA, código, texto, pesoCriterio]
      if (!r[0] || !r[4] || !r[5]) {
        descartadas.push('Línea ' + (i + 1) + ': faltan curso, código o texto.');
        return;
      }
      var pRA = r[3] === '' ? '' : Number(String(r[3]).replace(',', '.'));
      var pCr = r[6] === '' || r[6] == null ? '' : Number(String(r[6]).replace(',', '.'));
      if (pRA !== '' && isNaN(pRA)) { descartadas.push('Línea ' + (i + 1) + ': peso de RA no numérico.'); return; }
      if (pCr !== '' && isNaN(pCr)) { descartadas.push('Línea ' + (i + 1) + ': peso de criterio no numérico.'); return; }
      filasNuevas.push([r[0], r[1] || '', r[2] || '', pRA, r[4], r[5], pCr]);
    });
    if (!filasNuevas.length) {
      return { ok: false, error: 'No se encontró ninguna fila válida.', descartadas: descartadas };
    }
    // Códigos duplicados dentro del mismo bloque: aviso claro antes de guardar.
    var vistos = {};
    for (var j = 0; j < filasNuevas.length; j++) {
      var k = filasNuevas[j][0] + '||' + filasNuevas[j][1] + '||' + filasNuevas[j][4];
      if (vistos[k]) return { ok: false, error: 'Código repetido: ' + filasNuevas[j][4] + ' (en ' + filasNuevas[j][1] + ').' };
      vistos[k] = 1;
    }
    var sh = hoja_(ss);
    var bloques = {};
    filasNuevas.forEach(function (f) { bloques[f[0] + '||' + f[1]] = 1; });
    var conservadas = (sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues())
      .filter(function (f) { return f[0] && !bloques[String(f[0]).trim() + '||' + String(f[1]).trim()]; });
    var todas = conservadas.concat(filasNuevas);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    if (todas.length) sh.getRange(2, 1, todas.length, 7).setValues(todas);
    return { ok: true, filas: filasNuevas.length, bloques: Object.keys(bloques).length,
      descartadas: descartadas, resumen: resumen_(ss) };
  }

  /** Borra un bloque curso+área completo. */
  function borrar_(ss, curso, area) {
    var sh = hoja_(ss);
    if (sh.getLastRow() < 2) return { ok: true, resumen: [] };
    var datos = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues()
      .filter(function (f) {
        return f[0] && !(String(f[0]).trim() === curso && String(f[1]).trim() === area);
      });
    sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    if (datos.length) sh.getRange(2, 1, datos.length, 7).setValues(datos);
    return { ok: true, resumen: resumen_(ss) };
  }

  /** Detalle de un bloque para el editor de pesos: RA con sus criterios. */
  function detalle_(ss, curso, area) {
    var ras = {}, orden = [];
    filas_(ss).forEach(function (f) {
      if (f.curso !== curso || f.area !== area) return;
      var k = f.competencia || '';
      if (!ras[k]) { ras[k] = { ra: k, peso: f.pesoRA, criterios: [] }; orden.push(k); }
      if (ras[k].peso === '' && f.pesoRA !== '') ras[k].peso = f.pesoRA;
      ras[k].criterios.push({ codigo: f.codigo, texto: f.texto, peso: f.pesoCriterio });
    });
    return { curso: curso, area: area, ras: orden.map(function (k) { return ras[k]; }) };
  }

  /**
   * Actualiza SOLO los pesos de un bloque. pesos = {ras: {raTexto: peso},
   * criterios: {codigo: peso}} ('' = sin peso). No toca textos ni códigos.
   */
  function guardarPesos_(ss, curso, area, pesos) {
    var sh = hoja_(ss);
    if (sh.getLastRow() < 2) return { ok: true };
    var n = sh.getLastRow() - 1;
    var datos = sh.getRange(2, 1, n, 7).getValues();
    var pr = (pesos && pesos.ras) || {}, pc = (pesos && pesos.criterios) || {};
    var num = function (v) {
      if (v === '' || v == null) return '';
      var x = Number(String(v).replace(',', '.'));
      return isNaN(x) ? '' : x;
    };
    datos.forEach(function (f) {
      if (String(f[0]).trim() !== curso || String(f[1]).trim() !== area) return;
      var ra = String(f[2]).trim(), cod = String(f[4]).trim();
      if (ra in pr) f[3] = num(pr[ra]);
      if (cod in pc) f[6] = num(pc[cod]);
    });
    sh.getRange(2, 1, n, 7).setValues(datos);
    return { ok: true };
  }

  return { filas_: filas_, resumen_: resumen_, importar_: importar_, borrar_: borrar_,
    detalle_: detalle_, guardarPesos_: guardarPesos_ };
})();

/** Bloques de criterios propios del profe (curso+área con nº de RA/criterios). */
function getMapaPropio() {
  return MapaPropio.resumen_(abrirCuaderno_());
}

/** Importa criterios propios pegados desde una hoja. Devuelve {ok, ...}. */
function importarMapaPropio(texto) {
  return MapaPropio.importar_(abrirCuaderno_(), texto);
}

/** Elimina un bloque curso+área de criterios propios. */
function eliminarMapaPropio(curso, area) {
  return MapaPropio.borrar_(abrirCuaderno_(), curso, area);
}

/** Detalle de un bloque (RA + criterios con pesos) para el editor. */
function getMapaPropioDetalle(curso, area) {
  return MapaPropio.detalle_(abrirCuaderno_(), curso, area);
}

/** Guarda los pesos editados de un bloque. */
function guardarPesosMapaPropio(curso, area, pesos) {
  return MapaPropio.guardarPesos_(abrirCuaderno_(), curso, area, pesos);
}
