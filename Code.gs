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
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
  return {
    usuario: Session.getActiveUser().getEmail(),
    esquemaVersion: CONFIG.ESQUEMA_VERSION,
    areas: Curriculo.listarAreasCursos(),
    cursos: Cursos.info_(ss, clases),
    clases: Cursos.filtrar_(clases, activo),
    evaluaciones: Cursos.filtrar_(Evaluaciones.listar_(ss, clases), activo)
  };
}

/**
 * Copia de seguridad automática (máx. 1/día). La llama el cliente en segundo
 * plano tras cargar; nunca bloquea ni rompe la app (todo va en try/catch).
 */
function respaldoAutomatico() {
  try { Respaldo.siToca_(abrirCuaderno_()); } catch (e) {}
  return true;
}
