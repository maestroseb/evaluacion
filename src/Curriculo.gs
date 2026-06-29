/**
 * Acceso de SOLO LECTURA al Mapa Curricular central.
 *
 * El mapa vive en una única hoja que mantiene el administrador (tú). Contiene
 * todas las áreas y cursos con sus competencias específicas y criterios de
 * evaluación. Al estar centralizado, cualquier corrección o ampliación llega
 * a todos los profes sin que ellos hagan nada.
 *
 * Estructura esperada de la hoja central "Mapa Curricular":
 *   Una pestaña por (área + curso) o una pestaña única con columnas:
 *     curso | area | competencia | criterio_codigo | criterio_texto
 */
var Curriculo = (function () {

  function abrirMapa_() {
    if (CONFIG.MAPA_CURRICULAR_ID === 'PEGA_AQUI_EL_ID_DE_TU_MAPA_CURRICULAR') {
      throw new Error('Falta configurar MAPA_CURRICULAR_ID en Config.gs.');
    }
    return SpreadsheetApp.openById(CONFIG.MAPA_CURRICULAR_ID);
  }

  /** Lee la pestaña única "Mapa" con formato largo. Cacheado 6h. */
  function leerFilas_() {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('mapa_filas');
    if (hit) return JSON.parse(hit);

    var sh = abrirMapa_().getSheetByName('Mapa');
    if (!sh) throw new Error('La hoja central no tiene una pestaña "Mapa".');
    var datos = sh.getDataRange().getValues();
    var filas = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0] && !f[1]) continue;
      filas.push({
        curso: String(f[0]).trim(),
        area: String(f[1]).trim(),
        competencia: String(f[2]).trim(),
        codigo: String(f[3]).trim(),
        texto: String(f[4]).trim()
      });
    }
    cache.put('mapa_filas', JSON.stringify(filas), 21600);
    return filas;
  }

  /** Lista las combinaciones área+curso disponibles para crear un grupo. */
  function listarAreasCursos() {
    var filas = leerFilas_();
    var vistos = {};
    var out = [];
    filas.forEach(function (f) {
      var clave = f.curso + '||' + f.area;
      if (vistos[clave]) return;
      vistos[clave] = true;
      out.push({ curso: f.curso, area: f.area });
    });
    return out;
  }

  /** Devuelve los criterios (código + texto) de un área+curso concretos. */
  function criteriosDe(curso, area) {
    return leerFilas_()
      .filter(function (f) { return f.curso === curso && f.area === area; })
      .map(function (f) {
        return { codigo: f.codigo, texto: f.texto, competencia: f.competencia };
      });
  }

  return {
    listarAreasCursos: listarAreasCursos,
    criteriosDe: criteriosDe
  };
})();
