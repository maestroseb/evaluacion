/**
 * Copia de seguridad automática del cuaderno de cada profe.
 *
 * Estrategia sin triggers ni permisos extra: al abrir la app, si hace más de
 * ~20 h desde la última copia, se duplica el cuaderno (con fecha) en el Drive
 * del propio usuario y se conservan las últimas N. Si algo falla, NUNCA bloquea
 * la app (todo va envuelto en try/catch).
 *
 * Restaurar = abrir la copia en Drive (o usar Importar). Las copias heredan el
 * cifrado de nombres, así que también cumplen la LOPD.
 */
var Respaldo = (function () {

  var HORAS_MIN = 20;        // intervalo mínimo entre copias
  var MAX_COPIAS = 7;        // copias que se conservan

  function siToca_(ss) {
    try {
      var props = PropertiesService.getUserProperties();
      var ultimo = Number(props.getProperty('ultimoRespaldo') || 0);
      var ahora = Date.now();
      if (ahora - ultimo < HORAS_MIN * 3600 * 1000) return;
      hacer_(ss, props, ahora);
    } catch (e) { Logger.log('Respaldo.siToca_: ' + e); /* una copia fallida nunca rompe la app */ }
  }

  function hacer_(ss, props, ahora) {
    var fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm');
    var copia = ss.copy(CONFIG.NOMBRE_CUADERNO + ' — Copia ' + fecha);

    var lista = [];
    try { lista = JSON.parse(props.getProperty('respaldos') || '[]'); } catch (e) {}
    lista.push({ id: copia.getId(), fecha: fecha, ts: ahora });

    // Poda: deja solo las últimas MAX_COPIAS, enviando las viejas a la papelera.
    while (lista.length > MAX_COPIAS) {
      var viejo = lista.shift();
      try { DriveApp.getFileById(viejo.id).setTrashed(true); } catch (e) {}
    }
    props.setProperty('respaldos', JSON.stringify(lista));
    props.setProperty('ultimoRespaldo', String(ahora));
  }

  /** Fuerza una copia ahora (uso manual). Devuelve info de la copia. */
  function ahora_(ss) {
    var props = PropertiesService.getUserProperties();
    hacer_(ss, props, Date.now());
    var lista = JSON.parse(props.getProperty('respaldos') || '[]');
    return lista[lista.length - 1];
  }

  return { siToca_: siToca_, ahora_: ahora_ };
})();

/** Copia de seguridad manual: botón «Hacer copia ahora» (o desde el editor). */
function copiaDeSeguridadAhora() {
  var r = Respaldo.ahora_(abrirCuaderno_());
  Logger.log('Copia creada: ' + (r && r.fecha));
  return r;
}
