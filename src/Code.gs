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
    .setTitle('Evaluación por Criterios')
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
 * Devuelve el correo del usuario que ha accedido. Útil para la cabecera.
 */
function getUsuario() {
  return Session.getActiveUser().getEmail();
}

/**
 * Estado inicial que pide el frontend al cargar:
 * usuario, áreas/cursos disponibles en el mapa central y sus grupos.
 */
function getEstadoInicial() {
  var cuaderno = abrirCuaderno_();
  return {
    usuario: Session.getActiveUser().getEmail(),
    esquemaVersion: CONFIG.ESQUEMA_VERSION,
    areas: Curriculo.listarAreasCursos(),
    grupos: Datos.listarGrupos(cuaderno)
  };
}
