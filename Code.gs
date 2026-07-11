/**
 * Punto de entrada de la Web App.
 *
 * Se despliega como Web App con:
 *   - "Ejecutar como": el usuario que accede
 *   - "Acceso": cualquier usuario de g.educaand.es
 *
 * Al correr con la identidad del profe, su cuaderno de datos se crea y vive
 * en SU propio Drive, de forma totalmente aislada y privada.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('ui')
    .evaluate()
    .setTitle(CONFIG.NOMBRE_APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // DEFAULT = la app no puede embeberse en iframes de terceros (protección
    // anti-clickjacking). Se entra siempre por URL directa; si algún día se
    // quisiera incrustar en un Google Sites, habría que volver a ALLOWALL.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Permite incluir parciales HTML (CSS, JS) dentro de ui.html con
 * <?!= include('nombre') ?>.
 */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/**
 * Estado inicial que pide el frontend al cargar: usuario, áreas/cursos del mapa
 * central, las clases del profe y sus evaluaciones (clase + área).
 *
 * La copia de seguridad automática NO se hace aquí: el cliente la dispara en
 * segundo plano tras pintar (respaldoAutomatico), para no retrasar el arranque.
 */
function getEstadoInicial() {
  var ss = abrirCuaderno_();
  Cursos.backfill_(ss); // asigna curso académico a los datos antiguos (idempotente, 1 vez)
  var activo = Cursos.activo_();
  var clases = Clases.listar_(ss); // una sola lectura de _clases para todo el estado
  var email = Session.getActiveUser().getEmail();
  // Banderas de funcionalidad para este usuario: el cliente enseña u oculta
  // módulos en pruebas (p. ej. el planificador) según su valor.
  var flags = flagsDe_(email);
  // Migración v18→v19: las clases provisionales pasan a ser clases reales sin
  // grupo. Idempotente (vacía su pestaña); solo aplica a quien tenga el planner.
  if (flags.planner) Planner.migrarProvisionales_(ss);
  return {
    usuario: email,
    esquemaVersion: CONFIG.ESQUEMA_VERSION,
    flags: flags,
    areas: Curriculo.listarAreasCursos(),
    cursos: Cursos.info_(ss, clases),
    clases: Cursos.filtrar_(clases, activo),
    evaluaciones: Cursos.filtrar_(Evaluaciones.listar_(ss, clases), activo)
  };
}

/**
 * Banderas de funcionalidad para el correo dado. Cada bandera de CONFIG.FLAGS es
 * la lista de correos con acceso (o '*' = todo el mundo). Devuelve un objeto
 * { nombre: booleano }. Es el interruptor que permite tener módulos desplegados
 * pero ocultos hasta que se decida abrirlos, sin volver a desplegar código.
 */
function flagsDe_(email) {
  var out = {};
  var flags = CONFIG.FLAGS || {};
  Object.keys(flags).forEach(function (nombre) {
    var permitidos = flags[nombre];
    out[nombre] = permitidos === '*' ||
      (Array.isArray(permitidos) && permitidos.indexOf(email) >= 0);
  });
  return out;
}

/**
 * Copia de seguridad automática (máx. 1/día). La llama el cliente en segundo
 * plano tras cargar; nunca bloquea ni rompe la app (todo va en try/catch).
 */
function respaldoAutomatico() {
  try { Respaldo.siToca_(abrirCuaderno_()); }
  catch (e) { Logger.log('respaldoAutomatico: ' + e); }
  return true;
}
