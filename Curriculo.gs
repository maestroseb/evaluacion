/**
 * Acceso de SOLO LECTURA al Mapa Curricular central.
 *
 * El mapa vive en una única hoja que mantiene el administrador (tú). Contiene
 * todas las áreas y cursos con sus competencias específicas y criterios de
 * evaluación. Al estar centralizado, cualquier corrección o ampliación llega
 * a todos los profes sin que ellos hagan nada.
 *
 * Admite DOS formatos de hoja de forma automática:
 *
 *  A) Formato largo (simple): columnas
 *       curso | area | competencia | criterio_codigo | criterio_texto
 *
 *  B) Formato del "Mapa Curricular Primaria" (tablas apiladas en una pestaña):
 *       - Tabla de áreas:    CURSO | DESCRIPCIÓN | REF | SELECCIONADO...
 *       - Tabla de criterios: MATERIA | CURSO | COMP. ESPECÍFICA | Nº |
 *                             REF COMPLETA | DESCRIPTOR | DESCRIPCIÓN
 *     El área se resuelve uniendo MATERIA (p. ej. "LCL.2") con la REF de la
 *     tabla de áreas para obtener su nombre ("Lengua Castellana y Literatura").
 */
var Curriculo = (function () {

  function abrirMapa_() {
    if (CONFIG.MAPA_CURRICULAR_ID === 'PEGA_AQUI_EL_ID_DE_TU_MAPA_CURRICULAR') {
      throw new Error('Falta configurar MAPA_CURRICULAR_ID en Config.gs.');
    }
    return SpreadsheetApp.openById(CONFIG.MAPA_CURRICULAR_ID);
  }

  /** Normaliza una celda a texto recortado. */
  function txt_(v) { return String(v == null ? '' : v).trim(); }

  /** ¿La fila contiene todas estas cabeceras (insensible a may/min)? */
  function esCabecera_(fila, cabeceras) {
    var set = fila.map(function (c) { return txt_(c).toUpperCase(); });
    return cabeceras.every(function (h) { return set.indexOf(h) >= 0; });
  }

  /**
   * Lee la hoja central y devuelve filas normalizadas
   * {curso, area, competencia, codigo, texto}. Detecta el formato. Cacheado 6h.
   */
  function leerFilas_() {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('mapa_filas');
    if (hit) return JSON.parse(hit);

    var ss = abrirMapa_();
    var sh = ss.getSheetByName('Mapa') || ss.getSheets()[0];
    if (!sh) throw new Error('La hoja central de mapa curricular está vacía.');
    var datos = sh.getDataRange().getValues();

    var filas = detectarCriterios_(datos)
      ? parsearMapaPrimaria_(datos)
      : parsearFormatoLargo_(datos);

    cache.put('mapa_filas', JSON.stringify(filas), 21600);
    return filas;
  }

  /** ¿Hay una tabla de criterios estilo "Mapa Curricular Primaria"? */
  function detectarCriterios_(datos) {
    for (var i = 0; i < datos.length; i++) {
      if (esCabecera_(datos[i], ['REF COMPLETA', 'DESCRIPTOR'])) return true;
    }
    return false;
  }

  /** Formato largo simple: cabecera en la fila 1. */
  function parsearFormatoLargo_(datos) {
    var filas = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!txt_(f[0]) && !txt_(f[1])) continue;
      filas.push({
        curso: txt_(f[0]), area: txt_(f[1]), competencia: txt_(f[2]),
        codigo: txt_(f[3]), texto: txt_(f[4])
      });
    }
    return filas;
  }

  /** Formato "Mapa Curricular Primaria": tablas de áreas + criterios apiladas. */
  function parsearMapaPrimaria_(datos) {
    var areaPorRef = construirAreas_(datos); // REF (LCL.2) -> nombre de área

    // Localiza la cabecera de la tabla de criterios.
    var inicio = -1, col = {};
    for (var i = 0; i < datos.length; i++) {
      if (esCabecera_(datos[i], ['REF COMPLETA', 'DESCRIPTOR', 'MATERIA'])) {
        inicio = i + 1;
        datos[i].forEach(function (c, j) { col[txt_(c).toUpperCase()] = j; });
        break;
      }
    }
    if (inicio < 0) return [];

    var filas = [];
    for (var r = inicio; r < datos.length; r++) {
      var f = datos[r];
      var materia = txt_(f[col['MATERIA']]);
      var codigo = txt_(f[col['REF COMPLETA']]);
      if (!materia && !codigo) break; // fila en blanco = fin de la tabla
      if (!codigo) continue;
      filas.push({
        curso: txt_(f[col['CURSO']]),
        area: areaPorRef[materia] || materia,
        competencia: txt_(f[col['COMP. ESPECÍFICA']]),
        codigo: codigo,
        texto: txt_(f[col['DESCRIPTOR']]) || txt_(f[col['DESCRIPCIÓN']])
      });
    }
    return filas;
  }

  /** Mapea la REF de cada área (LCL.2) a su nombre legible. */
  function construirAreas_(datos) {
    var mapa = {};
    var inicio = -1, col = {};
    for (var i = 0; i < datos.length; i++) {
      if (esCabecera_(datos[i], ['CURSO', 'DESCRIPCIÓN', 'REF'])) {
        inicio = i + 1;
        datos[i].forEach(function (c, j) { col[txt_(c).toUpperCase()] = j; });
        break;
      }
    }
    if (inicio < 0) return mapa;
    for (var r = inicio; r < datos.length; r++) {
      var ref = txt_(datos[r][col['REF']]);
      var nombre = txt_(datos[r][col['DESCRIPCIÓN']]);
      if (!ref && !nombre) break;
      if (ref) mapa[ref] = nombre;
    }
    return mapa;
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
