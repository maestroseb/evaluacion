/**
 * Papelera: los borrados (grupo, clase, unidad, actividad) no desaparecen al
 * instante. Antes de borrar, se guarda una "foto" de las filas afectadas en la
 * pestaña _papelera; desde ahí se pueden RESTAURAR durante 30 días.
 *
 * La restauración simplemente vuelve a insertar las filas guardadas (con sus
 * ids originales), así que recupera el estado exacto. Es aditiva y de bajo
 * riesgo: nunca sobrescribe datos existentes.
 */

function listarPapelera() { return Papelera.listar_(abrirCuaderno_()); }
function restaurarPapelera(papeleraId) { return Papelera.restaurar_(abrirCuaderno_(), papeleraId); }
function vaciarPapelera() { return Papelera.vaciar_(abrirCuaderno_()); }

var Papelera = (function () {

  var DIAS = 30;

  function hoja_(ss) { return ss.getSheetByName(HOJAS.PAPELERA); }

  function guardar_(ss, tipo, etiqueta, contenido) {
    hoja_(ss).appendRow([
      Datos.nuevoId_('p'), tipo, etiqueta, new Date().toISOString(), JSON.stringify(contenido)
    ]);
  }

  function listar_(ss) {
    purgarViejas_(ss);
    var datos = hoja_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0]) out.push({
        papeleraId: datos[i][0], tipo: datos[i][1], etiqueta: datos[i][2], fecha: datos[i][3]
      });
    }
    return out.reverse(); // más recientes primero
  }

  function restaurar_(ss, papeleraId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, papeleraId);
    if (fila < 0) throw new Error('Elemento no encontrado en la papelera.');
    var contenido = {};
    try { contenido = JSON.parse(sh.getRange(fila, 5).getValue()); } catch (e) {}
    Object.keys(contenido).forEach(function (nombreHoja) {
      var dest = ss.getSheetByName(nombreHoja);
      var filas = contenido[nombreHoja] || [];
      if (dest && filas.length) {
        dest.getRange(dest.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
      }
    });
    sh.deleteRow(fila);
    return { ok: true };
  }

  function vaciar_(ss) {
    var sh = hoja_(ss);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    return { ok: true };
  }

  function purgarViejas_(ss) {
    var sh = hoja_(ss);
    var datos = sh.getDataRange().getValues();
    var limite = Date.now() - DIAS * 24 * 3600 * 1000;
    for (var i = datos.length - 1; i >= 1; i--) {
      var t = Date.parse(datos[i][3]);
      if (t && t < limite) sh.deleteRow(i + 1);
    }
  }

  // ---------- captura de filas antes de borrar ----------
  function filaPorId_(sh, id) {
    var idx = Datos.filaDeId_(sh, id);
    return idx < 0 ? null : sh.getRange(idx, 1, 1, sh.getLastColumn()).getValues()[0];
  }
  function filasPorCol_(sh, col0, valor) {
    var datos = sh.getDataRange().getValues(), out = [];
    for (var i = 1; i < datos.length; i++) if (datos[i][col0] === valor) out.push(datos[i]);
    return out;
  }

  /** Guarda en la papelera un grupo (clase de alumnado) antes de borrarlo. */
  function papelearGrupo_(ss, claseId) {
    var sh = ss.getSheetByName(HOJAS.CLASES);
    var row = filaPorId_(sh, claseId);
    if (!row) return;
    guardar_(ss, 'grupo', 'Grupo: ' + row[1], { _clases: [row] });
  }

  /** Guarda una clase (evaluación) antes de borrarla. */
  function papelearClase_(ss, evalId) {
    var sh = ss.getSheetByName(HOJAS.EVALUACIONES);
    var row = filaPorId_(sh, evalId);
    if (!row) return;
    guardar_(ss, 'clase', 'Clase: ' + row[2], { _evaluaciones: [row] });
  }

  /** Guarda una unidad con sus actividades e ítems antes de borrarla. */
  function papelearUnidad_(ss, unidadId) {
    var shU = ss.getSheetByName(HOJAS.UNIDADES);
    var uRow = filaPorId_(shU, unidadId);
    if (!uRow) return;
    var shA = ss.getSheetByName(HOJAS.ACTIVIDADES);
    var actsRows = filasPorCol_(shA, 1, unidadId);
    var shI = ss.getSheetByName(HOJAS.ITEMS);
    var itemsRows = [];
    actsRows.forEach(function (a) { itemsRows = itemsRows.concat(filasPorCol_(shI, 0, a[0])); });
    guardar_(ss, 'unidad', 'Unidad: ' + uRow[2],
      { _unidades: [uRow], _actividades: actsRows, _items: itemsRows });
  }

  /** Guarda una actividad con sus ítems antes de borrarla. */
  function papelearActividad_(ss, actividadId) {
    var shA = ss.getSheetByName(HOJAS.ACTIVIDADES);
    var aRow = filaPorId_(shA, actividadId);
    if (!aRow) return;
    var shI = ss.getSheetByName(HOJAS.ITEMS);
    var itemsRows = filasPorCol_(shI, 0, actividadId);
    guardar_(ss, 'actividad', 'Actividad: ' + aRow[2], { _actividades: [aRow], _items: itemsRows });
  }

  return {
    listar_: listar_, restaurar_: restaurar_, vaciar_: vaciar_,
    papelearGrupo_: papelearGrupo_, papelearClase_: papelearClase_,
    papelearUnidad_: papelearUnidad_, papelearActividad_: papelearActividad_
  };
})();
