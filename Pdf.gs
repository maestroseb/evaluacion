/**
 * Generación de PDF con Google Docs.
 *
 * El conversor HTML→PDF de Apps Script descarta los rellenos de color, así que
 * para conseguir las bandas de color (estilo Planboard) usamos un Google Doc
 * con celdas de tabla con color de fondo nativo —que sí se exportan a PDF y
 * paginan solas—. Se reutiliza un único Doc «borrador» por profesor (se limpia
 * y reescribe) y se exporta por la URL de descarga de Docs.
 *
 * El cliente envía un `payload` con la estructura ya resuelta (colores, textos),
 * de modo que este módulo solo maqueta. Pensado para reutilizarse en informes.
 *
 * Solo necesita el scope documents (crear/editar el Doc) + drive.file (que ya
 * usa la app); NO usa el permiso amplio de Drive ni la Drive API REST.
 */
function generarPdfDoc(payload, nombre) {
  return Pdf.generarDoc_(payload || {}, nombre);
}

var Pdf = (function () {
  var BLANCO = '#ffffff';

  function san_(n) {
    return String(n || 'planificacion').replace(/[^\p{L}\p{N} .\-]/gu, '_').slice(0, 90);
  }

  /** Estilo de un párrafo (color, negrita, cursiva, tamaño, alineación, espaciado). */
  function styleP_(p, o) {
    o = o || {};
    var t = p.editAsText();
    if (o.color) t.setForegroundColor(o.color);
    if (o.hi) t.setBackgroundColor(o.hi); // resaltado del texto (highlight)
    if (o.bold != null) t.setBold(o.bold);
    if (o.italic) t.setItalic(true);
    if (o.size) t.setFontSize(o.size);
    if (o.align) p.setAlignment(o.align);
    p.setSpacingBefore(o.sb != null ? o.sb : 0).setSpacingAfter(o.sa != null ? o.sa : 0);
    return p;
  }

  function generarDoc_(payload, nombre) {
    nombre = san_(nombre);
    var paso = 'inicio';
    try {
      paso = 'crear';
      // Un único Doc «borrador» reutilizable por profesor: así no hay que borrar
      // un temporal en cada exportación (borrar exigiría el permiso amplio de
      // Drive). Se limpia y se reescribe.
      var doc = docBorrador_();
      var id = doc.getId();
      var body = doc.getBody().clear();
      body.setMarginTop(26).setMarginBottom(26).setMarginLeft(30).setMarginRight(30);
      // Orientación explícita cada vez (el Doc se reutiliza): A4 vertical/apaisado.
      if (payload.orientacion === 'landscape') { body.setPageWidth(842).setPageHeight(595); }
      else { body.setPageWidth(595).setPageHeight(842); }
      paso = 'titulo';
      // Título con appendParagraph (no depende del primer hijo del cuerpo) y se
      // quita el párrafo vacío inicial para no dejar un hueco arriba.
      var vacio = body.getChild(0);
      styleP_(body.appendParagraph(payload.titulo || ''), { bold: true, size: 18, color: '#111111', sa: 2 });
      try {
        if (vacio.getType() === DocumentApp.ElementType.PARAGRAPH && vacio.asParagraph().getText() === '') {
          body.removeChild(vacio);
        }
      } catch (e0) {}
      paso = 'meta';
      if (payload.meta) styleP_(body.appendParagraph(payload.meta), { size: 10, color: '#6b7280', sa: 6 });
      body.appendHorizontalRule();
      paso = 'avisos';
      avisos_(body, payload.avisos || []);
      paso = 'cuerpo';
      if (payload.tipo === 'semana') semana_(body, payload);
      else dia_(body, payload.tarjetas || []);
      paso = 'guardar';
      doc.saveAndClose();
      paso = 'export';
      // Export por la URL de descarga de Google Docs (la del menú «Descargar
      // como PDF»): va con el token del usuario y NO usa la Drive API REST (no
      // hay que habilitarla) ni DriveApp.getFileById (que exige el permiso
      // amplio de Drive). Basta con documents / drive.file sobre el propio Doc.
      var resp = UrlFetchApp.fetch(
        'https://docs.google.com/document/d/' + id + '/export?format=pdf',
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true, followRedirects: true });
      var ct = String(resp.getHeaders()['Content-Type'] || resp.getHeaders()['content-type'] || '');
      if (resp.getResponseCode() !== 200 || ct.indexOf('pdf') < 0) {
        return { ok: false, error: 'export ' + resp.getResponseCode() + ' ct=' + ct + ' ' +
          resp.getContentText().slice(0, 160) };
      }
      return { ok: true, b64: Utilities.base64Encode(resp.getBlob().getBytes()), nombre: nombre + '.pdf' };
    } catch (e) {
      // El prefijo «pdf6/paso» confirma qué versión corre y en qué punto falló.
      return { ok: false, error: 'pdf6/' + paso + ': ' + ((e && e.message) || String(e)) };
    }
  }

  /**
   * Doc «borrador» reutilizable por profesor (id en las propiedades del usuario).
   * Reutilizarlo evita tener que borrar un temporal en cada exportación —borrar
   * exigiría el permiso amplio de Drive—. Si el guardado se perdió (el profe lo
   * borró), se crea de nuevo.
   */
  function docBorrador_() {
    var props = PropertiesService.getUserProperties();
    var id = props.getProperty('pdfBorradorId');
    if (id) {
      try { var d = DocumentApp.openById(id); d.getBody(); return d; } catch (e) {}
    }
    var doc = DocumentApp.create('EvaluAnda — PDF (borrador, no borrar)');
    props.setProperty('pdfBorradorId', doc.getId());
    return doc;
  }

  /** Primer párrafo de una celda creada con texto (getChild(0) ya existe). */
  function pCelda_(cell) { return cell.getChild(0).asParagraph(); }

  function avisos_(body, avisos) {
    if (!avisos.length) return;
    var t = body.appendTable(); t.setBorderWidth(0);
    // Celda creada CON texto: así trae su párrafo (una celda vacía no lo tiene).
    var cell = t.appendTableRow().appendTableCell('No olvidar');
    cell.setBackgroundColor('#fff8e1')
      .setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(11).setPaddingRight(11);
    styleP_(pCelda_(cell), { bold: true, size: 11, color: '#8a6d10' });
    avisos.forEach(function (av) {
      styleP_(cell.appendParagraph('• ' + (av.titulo || 'Aviso') + (av.texto ? ' — ' + av.texto : '')),
        { size: 11, color: '#7a5f10' });
    });
    styleP_(body.appendParagraph(''), { size: 6 });
  }

  /** Vista Día: una tarjeta por sesión con banda de color (título + hora) y descripción. */
  function dia_(body, tarjetas) {
    tarjetas.forEach(function (c) {
      var col = c.color || '#5b5bd6';
      var t = body.appendTable(); t.setBorderWidth(0);
      var row = t.appendTableRow();
      // La CLASE en grande y, debajo, el título de la sesión más pequeño.
      var principal = c.clase || c.titulo || 'Sin título';
      var secundario = c.clase ? c.titulo : '';
      var cA = row.appendTableCell(principal);
      var cB = row.appendTableCell(c.hora || ' ');
      cA.setBackgroundColor(col).setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(12).setPaddingRight(6);
      cB.setBackgroundColor(col).setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(6).setPaddingRight(12);
      styleP_(pCelda_(cA), { bold: true, size: 13, color: BLANCO });
      if (secundario) styleP_(cA.appendParagraph(secundario), { size: 10, color: BLANCO });
      styleP_(pCelda_(cB), { bold: true, size: 11, color: BLANCO, align: DocumentApp.HorizontalAlignment.RIGHT });
      try { t.setColumnWidth(1, 96); } catch (e) {}
      if (c.desc) styleP_(body.appendParagraph(c.desc), { bold: false, size: 11, color: '#333333', sb: 4 });
      if (c.obs) styleP_(body.appendParagraph('Obs.: ' + c.obs),
        { bold: false, size: 10, color: '#666666', italic: true });
      styleP_(body.appendParagraph(''), { size: 6 });
    });
  }

  /** Vista Semana: rejilla clases × días con celdas de color por sesión. */
  function semana_(body, p) {
    var t = body.appendTable();
    // Bordes en BLANCO: sin líneas visibles (aire premium), y así la cabecera de
    // color y su descripción se ven como un bloque continuo.
    t.setBorderWidth(1).setBorderColor('#ffffff');
    var hr = t.appendTableRow();
    styleP_(pCelda_(hr.appendTableCell(' ')), { size: 9 });
    (p.dias || []).forEach(function (d) {
      var c = hr.appendTableCell(d || ' ');
      c.setPaddingTop(3).setPaddingBottom(6).setPaddingLeft(5).setPaddingRight(5);
      styleP_(pCelda_(c), { bold: true, size: 9, color: '#374151' });
    });
    // Cada clase ocupa DOS filas: la de arriba con la cabecera de color (título)
    // y la de abajo, en blanco, con la descripción. Así el color va a todo el
    // ancho de la celda (una celda de Docs solo admite un color de fondo).
    (p.filas || []).forEach(function (fila) {
      var rT = t.appendTableRow(); // fila de títulos (con color)
      var rD = t.appendTableRow(); // fila de descripciones (en blanco)
      var clT = rT.appendTableCell(fila.etq || ' ');
      clT.setPaddingTop(5).setPaddingBottom(2).setPaddingLeft(4).setPaddingRight(6);
      styleP_(pCelda_(clT), { bold: true, size: 9, color: '#111111' });
      var clD = rD.appendTableCell(' ');
      clD.setPaddingTop(0).setPaddingBottom(5).setPaddingLeft(4).setPaddingRight(6);
      (fila.celdas || []).forEach(function (cards) {
        var tiene = cards && cards.length;
        // Fila 1: título con fondo de color (banda a todo el ancho de la celda).
        var cT = rT.appendTableCell(tiene ? (cards[0].titulo || 'Sin título') : '');
        cT.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6).setPaddingRight(6);
        if (tiene) {
          cT.setBackgroundColor(cards[0].color || '#5b5bd6');
          styleP_(pCelda_(cT), { bold: true, size: 9, color: BLANCO });
          cards.slice(1).forEach(function (cd) {
            styleP_(cT.appendParagraph(cd.titulo || 'Sin título'), { bold: true, size: 9, color: BLANCO });
          });
        }
        // Fila 2: descripción en texto normal sobre blanco.
        var desc = tiene ? cards.map(function (c) { return c.desc; }).filter(Boolean).join(' · ') : '';
        var cD = rD.appendTableCell(desc);
        cD.setPaddingTop(0).setPaddingBottom(4).setPaddingLeft(6).setPaddingRight(6);
        if (desc) styleP_(pCelda_(cD), { bold: false, size: 8, color: '#333333' });
      });
    });
    // Anchos: 1ª columna al ancho (mínimo) del nombre de clase más largo; las
    // columnas de día se reparten el resto de la página a partes iguales.
    var nDias = (p.dias || []).length;
    if (nDias) {
      var maxCh = 6;
      (p.filas || []).forEach(function (f) { maxCh = Math.max(maxCh, String(f.etq || '').length); });
      var ancho = (p.orientacion === 'landscape' ? 842 : 595) - 60; // menos márgenes (30+30)
      var w0 = Math.min(170, Math.max(70, Math.round(maxCh * 5.4) + 14));
      var wd = Math.max(60, Math.floor((ancho - w0) / nDias));
      try {
        t.setColumnWidth(0, w0);
        for (var i = 1; i <= nDias; i++) t.setColumnWidth(i, wd);
      } catch (e) {}
    }
  }

  return { generarDoc_: generarDoc_ };
})();
