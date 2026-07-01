/**
 * Exportar / importar todos los datos del profe (copia de seguridad manual y
 * portabilidad LOPD). La exportación incluye los nombres EN CLARO (es la copia
 * personal del propio usuario); al importar se vuelven a cifrar.
 */

function getExportacion() {
  var ss = abrirCuaderno_();
  function filas(nombre) {
    var d = ss.getSheetByName(nombre).getDataRange().getValues();
    return d.slice(1).filter(function (r) { return r[0] !== '' && r[0] != null; });
  }
  var clases = filas(HOJAS.CLASES).map(function (r) {
    var al = [];
    try {
      al = JSON.parse(r[4] || '[]').map(function (a) {
        return { id: a.id, nombre: Cripto.descifrar(a.nombre) };
      });
    } catch (e) {}
    return { claseId: r[0], nombre: r[1], curso: r[2], creado: r[3], alumnos: al,
      color: r[5] || '', icono: r[6] || '', orden: r[7] || '', cursoAcademico: r[8] || '' };
  });
  return {
    version: CONFIG.ESQUEMA_VERSION,
    fecha: new Date().toISOString(),
    usuario: Session.getActiveUser().getEmail(),
    clases: clases,
    evaluaciones: filas(HOJAS.EVALUACIONES),
    unidades: filas(HOJAS.UNIDADES),
    actividades: filas(HOJAS.ACTIVIDADES),
    notas: filas(HOJAS.NOTAS),
    items: filas(HOJAS.ITEMS) // legado (copia congelada); se conserva por compatibilidad
  };
}

/**
 * Restaura una exportación: SUSTITUYE los datos actuales por los del archivo.
 * Hace una copia de seguridad antes, por si acaso. Los nombres se re-cifran.
 */
function importarDatos(datos) {
  if (!datos || !datos.version) throw new Error('El archivo no es una copia válida.');
  var ss = abrirCuaderno_();
  Respaldo.ahora_(ss); // copia de seguridad antes de sobrescribir

  function escribir(nombre, filas) {
    var sh = ss.getSheetByName(nombre);
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    }
    if (filas && filas.length) sh.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
  }

  var clasesRows = (datos.clases || []).map(function (c) {
    var al = (c.alumnos || []).map(function (a) {
      return { id: a.id, nombre: Cripto.cifrar(a.nombre) };
    });
    return [c.claseId, c.nombre, c.curso, c.creado, JSON.stringify(al),
      c.color || '', c.icono || '', c.orden || '', c.cursoAcademico || ''];
  });
  escribir(HOJAS.CLASES, clasesRows);
  escribir(HOJAS.EVALUACIONES, datos.evaluaciones || []);
  escribir(HOJAS.UNIDADES, datos.unidades || []);
  escribir(HOJAS.ACTIVIDADES, datos.actividades || []);
  escribir(HOJAS.NOTAS, datos.notas || []);
  escribir(HOJAS.ITEMS, datos.items || []);
  return { ok: true };
}
