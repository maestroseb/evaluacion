/**
 * Funciones de mantenimiento puntual, para ejecutar A MANO desde el editor de
 * Apps Script. No las llama la aplicación.
 */

/**
 * Elimina la pestaña legado `_items` del cuaderno del usuario. Quedó como copia
 * congelada tras pasar las notas a `_notas`; ya no se usa. Segura de repetir: si
 * la pestaña no existe, no hace nada. Ejecútala una vez por cuaderno.
 */
function eliminarPestanaItemsLegado() {
  var ss = abrirCuaderno_();
  var sh = ss.getSheetByName('_items');
  if (!sh) return 'No hay pestaña _items: nada que borrar.';
  ss.deleteSheet(sh);
  return 'Pestaña _items eliminada.';
}
