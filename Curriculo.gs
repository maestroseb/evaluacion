/**
 * Acceso de SOLO LECTURA al Mapa Curricular central.
 *
 * Fuente principal: JSON públicos en GitHub (CONFIG.MAPA_JSON_URLS, uno por
 * etapa; se fusionan al cargar), arrays de objetos { curso, area, competencia,
 * codigo, texto, areaRef? }. Al ser URLs públicas no requieren permisos de
 * Drive y se sirven igual a toda la comunidad. Si MAPA_JSON_URLS está vacío,
 * se lee de la hoja de cálculo (CONFIG.MAPA_CURRICULAR_ID) como alternativa.
 *
 * La hoja admite dos formatos (detectados solos):
 *  A) Largo: curso | area | competencia | criterio_codigo | criterio_texto
 *  B) "Mapa Curricular Primaria": tablas de áreas + criterios apiladas, donde
 *     el área se resuelve uniendo MATERIA con la tabla de áreas.
 */
var Curriculo = (function () {

  /** Normaliza una celda a texto recortado. */
  function txt_(v) { return String(v == null ? '' : v).trim(); }

  // ---------- caché (troceada: CacheService limita ~100 KB por valor) ----------
  // La clave depende de la fuente: si cambias de URLs/hoja, la caché se invalida.
  function urlsMapa_() { return CONFIG.MAPA_JSON_URLS || []; }
  function claveCache_() {
    return 'mapa_' + (urlsMapa_().join('|') || CONFIG.MAPA_CURRICULAR_ID || '');
  }
  var CACHE_SEG = 90000;

  function getCache_() {
    var cache = CacheService.getScriptCache();
    var n = cache.get(claveCache_() + '_n');
    if (!n) return null;
    n = Number(n);
    var claves = [];
    for (var i = 0; i < n; i++) claves.push(claveCache_() + '_' + i);
    var trozos = cache.getAll(claves);
    var s = '';
    for (var j = 0; j < n; j++) {
      var t = trozos[claveCache_() + '_' + j];
      if (t == null) return null;
      s += t;
    }
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function putCache_(filas) {
    var cache = CacheService.getScriptCache();
    var s = JSON.stringify(filas);
    var obj = {}, n = 0;
    for (var i = 0; i < s.length; i += CACHE_SEG) {
      obj[claveCache_() + '_' + n] = s.substring(i, i + CACHE_SEG);
      n++;
    }
    obj[claveCache_() + '_n'] = String(n);
    try { cache.putAll(obj, 21600); } catch (e) { /* sin caché si no cabe */ }
  }

  function borrarCache_() {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(claveCache_() + '_n') || 0);
    var claves = [claveCache_() + '_n'];
    for (var i = 0; i < n; i++) claves.push(claveCache_() + '_' + i);
    cache.removeAll(claves);
  }

  // ---------- carga ----------
  function leerFilas_() {
    var hit = getCache_();
    if (hit) return hit;

    var filas = urlsMapa_().length ? leerDesdeJson_() : leerDesdeHoja_();
    putCache_(filas);
    return filas;
  }

  /**
   * Descarga y fusiona los JSON públicos del mapa (uno por etapa) desde GitHub.
   * fetchAll los pide en paralelo: añadir etapas no encarece la carga.
   */
  function leerDesdeJson_() {
    var urls = urlsMapa_();
    var resps = UrlFetchApp.fetchAll(urls.map(function (u) {
      return { url: u, muteHttpExceptions: true };
    }));
    var filas = [];
    resps.forEach(function (resp, i) {
      if (resp.getResponseCode() !== 200) {
        throw new Error('No se pudo descargar el mapa curricular (HTTP ' +
          resp.getResponseCode() + ' en ' + urls[i] +
          '). Revisa MAPA_JSON_URLS y que el repo sea público.');
      }
      JSON.parse(resp.getContentText()).forEach(function (o) {
        filas.push({
          curso: txt_(o.curso), area: txt_(o.area),
          competencia: txt_(o.competencia), codigo: txt_(o.codigo),
          texto: txt_(o.texto), descripcion: txt_(o.descripcion)
        });
      });
    });
    return filas;
  }

  /** Vacía la caché del mapa. Útil tras actualizar el JSON o la hoja. */
  function refrescar() {
    borrarCache_();
    return leerFilas_().length;
  }

  // ---------- lectura desde hoja (alternativa) ----------
  function abrirMapa_() {
    if (!CONFIG.MAPA_CURRICULAR_ID) {
      throw new Error('No hay fuente de mapa: configura MAPA_JSON_URLS o MAPA_CURRICULAR_ID.');
    }
    return SpreadsheetApp.openById(CONFIG.MAPA_CURRICULAR_ID);
  }

  function esCabecera_(fila, cabeceras) {
    var set = fila.map(function (c) { return txt_(c).toUpperCase(); });
    return cabeceras.every(function (h) { return set.indexOf(h) >= 0; });
  }

  /** ¿La fila es un separador de tabla (markdown/estructura :-:)? */
  function esSeparador_(fila) {
    var algo = false;
    for (var i = 0; i < fila.length; i++) {
      var c = txt_(fila[i]);
      if (c) { algo = true; if (!/^:?-+:?$/.test(c)) return false; }
    }
    return algo;
  }

  /** ¿La fila está totalmente vacía? */
  function esVacia_(fila) {
    return fila.every(function (c) { return !txt_(c); });
  }

  /** Límite entre tablas: fila vacía (hoja real) o separadora (markdown). */
  function esLimite_(fila) {
    return esVacia_(fila) || esSeparador_(fila);
  }

  function leerDesdeHoja_() {
    var ss = abrirMapa_();
    var sh = ss.getSheetByName('Mapa') || ss.getSheets()[0];
    if (!sh) throw new Error('La hoja central de mapa curricular está vacía.');
    var datos = sh.getDataRange().getValues();
    return detectarCriterios_(datos)
      ? parsearMapaPrimaria_(datos)
      : parsearFormatoLargo_(datos);
  }

  function detectarCriterios_(datos) {
    for (var i = 0; i < datos.length; i++) {
      if (esCabecera_(datos[i], ['REF COMPLETA', 'DESCRIPTOR'])) return true;
    }
    return false;
  }

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

  /**
   * "Mapa Curricular Primaria": tablas apiladas. Cada tabla acaba donde empieza
   * la siguiente cabecera; usamos las filas separadoras (la fila tras una
   * cabecera) para delimitar y no invadir la tabla siguiente.
   */
  function parsearMapaPrimaria_(datos) {
    var areaPorRef = construirAreas_(datos);
    var t = localizarTabla_(datos, ['REF COMPLETA', 'DESCRIPTOR', 'MATERIA']);
    if (!t) return [];
    var col = t.col, filas = [];
    for (var r = t.inicio; r < t.fin; r++) {
      var f = datos[r];
      var codigo = txt_(f[col['REF COMPLETA']]);
      if (!codigo) continue;
      var materia = txt_(f[col['MATERIA']]);
      filas.push({
        curso: txt_(f[col['CURSO']]),
        area: areaPorRef[materia] || materia,
        competencia: txt_(f[col['COMP. ESPECÍFICA']]),
        codigo: codigo,
        texto: txt_(f[col['DESCRIPTOR']]) || txt_(f[col['DESCRIPCIÓN']]),
        descripcion: txt_(f[col['DESCRIPCIÓN']])
      });
    }
    return filas;
  }

  function construirAreas_(datos) {
    var mapa = {};
    var t = localizarTabla_(datos, ['CURSO', 'DESCRIPCIÓN', 'REF']);
    if (!t) return mapa;
    for (var r = t.inicio; r < t.fin; r++) {
      var ref = txt_(datos[r][t.col['REF']]);
      var nombre = txt_(datos[r][t.col['DESCRIPCIÓN']]);
      if (ref) mapa[ref] = nombre;
    }
    return mapa;
  }

  /**
   * Localiza una tabla por sus cabeceras y devuelve {col, inicio, fin}, donde
   * "fin" es el comienzo de la siguiente cabecera (o el final de los datos).
   */
  function localizarTabla_(datos, cabeceras) {
    for (var i = 0; i < datos.length; i++) {
      if (!esCabecera_(datos[i], cabeceras)) continue;
      var col = {};
      datos[i].forEach(function (c, j) { col[txt_(c).toUpperCase()] = j; });
      var inicio = i + 1;
      // Saltamos una posible fila separadora (markdown) justo bajo la cabecera.
      if (inicio < datos.length && esSeparador_(datos[inicio])) inicio++;
      // El fin es el primer límite de tabla: fila vacía (hoja real) o la
      // siguiente cabecera (fila seguida de separador, en markdown).
      var fin = datos.length;
      for (var k = inicio; k < datos.length; k++) {
        if (esVacia_(datos[k]) || (k < datos.length - 1 && esSeparador_(datos[k + 1]))) {
          fin = k; break;
        }
      }
      return { col: col, inicio: inicio, fin: fin };
    }
    return null;
  }

  // ---------- API pública ----------
  function listarAreasCursos() {
    var filas = leerFilas_();
    var vistos = {}, out = [];
    filas.forEach(function (f) {
      var clave = f.curso + '||' + f.area;
      if (vistos[clave]) return;
      vistos[clave] = true;
      out.push({ curso: f.curso, area: f.area });
    });
    return out;
  }

  function criteriosDe(curso, area) {
    return leerFilas_()
      .filter(function (f) { return f.curso === curso && f.area === area; })
      .map(function (f) {
        return {
          codigo: f.codigo, texto: f.texto,
          descripcion: f.descripcion || '', competencia: f.competencia
        };
      });
  }

  /**
   * Todos los códigos de criterio de un nivel (de cualquier área), como objeto
   * { codigo: true } para comprobar pertenencia rápido. Se usa al promocionar
   * de nivel para validar los criterios remapeados (p. ej. LCL.4.4.1→LCL.5.4.1).
   */
  function codigosDeNivel(curso) {
    var set = {};
    leerFilas_().forEach(function (f) {
      if (f.curso === curso && f.codigo) set[f.codigo] = true;
    });
    return set;
  }

  return {
    listarAreasCursos: listarAreasCursos,
    criteriosDe: criteriosDe,
    codigosDeNivel: codigosDeNivel,
    refrescar: refrescar,
    desdeHoja: leerDesdeHoja_  // lee SIEMPRE de la hoja (para exportar el JSON)
  };
})();

/**
 * Ejecuta esta función desde el editor de Apps Script (selecciona
 * "refrescarMapa" y pulsa ▶) para vaciar la caché tras actualizar el mapa.
 */
function refrescarMapa() {
  var n = Curriculo.refrescar();
  Logger.log('Mapa recargado: ' + n + ' criterios.');
  return n;
}
