/**
 * Traspaso de grupos entre docentes (p. ej. titular → sustituto/a).
 *
 * La persona titular ELIGE qué grupos pasar y descarga un archivo con esos
 * grupos completos: alumnado, clases (evaluaciones), unidades, actividades y
 * notas. La receptora lo importa desde su propia app y los grupos se AÑADEN a
 * su cuaderno sin tocar los que ya tenga.
 *
 * Claves del diseño:
 *  - Aditivo: la importación solo añade filas; nunca borra ni sobrescribe.
 *  - Ids regenerados: al recibir se crean ids nuevos para todo (grupos,
 *    clases, unidades, actividades, alumnado) y se reescriben las referencias,
 *    incluidas las notas. Imposible chocar con los ids del receptor.
 *  - Cifrado por usuario: los nombres viajan en claro en el archivo (como en
 *    la copia personal) y se re-cifran con la clave de quien recibe.
 */

/** Descarga un traspaso con los grupos elegidos. claseIds: ['c_...', ...] */
function exportarGrupos(claseIds) {
  return Traspaso.exportar_(abrirCuaderno_(), claseIds || []);
}

/**
 * Recibe un traspaso: añade sus grupos al cuaderno propio (aditivo).
 * archivarClaseIds (opcional): grupos PROPIOS a archivar en la misma operación
 * (los coincidentes con el archivo, para no verlos duplicados).
 */
function importarGrupos(datos, archivarClaseIds) {
  return Traspaso.importar_(abrirCuaderno_(), datos, archivarClaseIds);
}

var Traspaso = (function () {

  function filas_(ss, nombre) {
    var d = ss.getSheetByName(nombre).getDataRange().getValues();
    return d.slice(1).filter(function (r) { return r[0] !== '' && r[0] != null; });
  }

  function alumnosEnClaro_(json) {
    try {
      return JSON.parse(json || '[]').map(function (a) {
        return { id: a.id, nombre: Cripto.descifrar(a.nombre) };
      });
    } catch (e) { return []; }
  }

  function exportar_(ss, claseIds) {
    if (!claseIds.length) throw new Error('Elige al menos un grupo para traspasar.');
    var setC = {};
    claseIds.forEach(function (id) { setC[id] = true; });

    var clases = filas_(ss, HOJAS.CLASES).filter(function (r) { return setC[r[0]]; });
    if (!clases.length) throw new Error('No se encontraron los grupos elegidos.');
    var evals = filas_(ss, HOJAS.EVALUACIONES).filter(function (r) { return setC[r[1]]; });
    var setE = {};
    evals.forEach(function (r) { setE[r[0]] = true; });
    var unidades = filas_(ss, HOJAS.UNIDADES).filter(function (r) { return setE[r[1]]; });
    var setU = {};
    unidades.forEach(function (r) { setU[r[0]] = true; });
    var actividades = filas_(ss, HOJAS.ACTIVIDADES).filter(function (r) { return setU[r[1]]; });
    // Rúbricas del banco usadas por columnas de tipo "rubrica": viajan con el
    // traspaso (sin ellas esas columnas llegarían sin definición al receptor).
    var rubUsadas = {};
    actividades.forEach(function (r) { if (r[8]) rubUsadas[r[8]] = true; });
    var rubricas = filas_(ss, HOJAS.RUBRICAS).filter(function (r) { return rubUsadas[r[0]]; });
    // Observaciones en claro en el archivo (como los nombres): quien recibe
    // las re-cifra con su propia clave.
    var notas = filas_(ss, HOJAS.NOTAS).filter(function (r) { return setU[r[0]]; })
      .map(function (r) { return [r[0], Notas.jsonEnClaro_(r[1])]; });

    return {
      tipo: 'traspaso',
      version: CONFIG.ESQUEMA_VERSION,
      fecha: new Date().toISOString(),
      de: Session.getActiveUser().getEmail(),
      // Grupos estructurados (nombres en claro; se re-cifran al recibir).
      clases: clases.map(function (r) {
        return { claseId: r[0], nombre: r[1], curso: r[2], creado: r[3],
          alumnos: alumnosEnClaro_(r[4]), color: r[5] || '', icono: r[6] || '',
          cursoAcademico: r[8] || '', bajas: alumnosEnClaro_(r[9]) };
      }),
      // El resto, filas crudas de sus pestañas (los ids se remapean al recibir).
      evaluaciones: evals,
      unidades: unidades,
      actividades: actividades,
      rubricas: rubricas,
      notas: notas
    };
  }

  function importar_(ss, d, archivarClaseIds) {
    if (!d || d.tipo !== 'traspaso' || !d.clases || !d.clases.length) {
      throw new Error('El archivo no es un traspaso válido.');
    }
    var lock = LockService.getUserLock();
    try { lock.waitLock(25000); }
    catch (e) { throw new Error('No se pudo recibir el traspaso (ocupado). Reintenta.'); }
    try {
      // Ids nuevos para todo, con mapa viejo→nuevo para reescribir referencias.
      var mapa = {};
      function nuevo(prefijo, viejo) {
        if (!viejo) return viejo;
        if (!mapa[viejo]) mapa[viejo] = Datos.nuevoId_(prefijo);
        return mapa[viejo];
      }
      function recifrar(lista) {
        return JSON.stringify((lista || []).map(function (a) {
          return { id: nuevo('a', a.id), nombre: Cripto.cifrar(a.nombre) };
        }));
      }

      var ordenC = Datos.siguienteOrden_(Clases.listar_(ss));
      var ordenE = Datos.siguienteOrden_(Evaluaciones.listar_(ss));
      var activo = Cursos.activo_();

      var filasC = d.clases.map(function (c, i) {
        return [nuevo('c', c.claseId), c.nombre, c.curso,
          c.creado || new Date().toISOString(), recifrar(c.alumnos),
          c.color || '', c.icono || '', ordenC + i,
          c.cursoAcademico || activo, recifrar(c.bajas)];
      });
      var filasE = (d.evaluaciones || []).filter(function (r) { return mapa[r[1]]; })
        .map(function (r, i) {
          return [nuevo('e', r[0]), mapa[r[1]], r[2], r[3], r[4] || '', r[5] || '',
            r[6] || '', ordenE + i, r[8] || activo];
        });
      var filasU = (d.unidades || []).filter(function (r) { return mapa[r[1]]; })
        .map(function (r) { return [nuevo('u', r[0]), mapa[r[1]], r[2], r[3]]; });
      // Rúbricas que acompañan al traspaso: ids nuevos y orden al final del banco
      // propio (los archivos antiguos no traen 'rubricas': lista vacía).
      var ordenR = Datos.siguienteOrden_(Rubricas.listar_(ss));
      var filasR = (d.rubricas || []).map(function (r, i) {
        return [nuevo('rub', r[0]), r[1], r[2], r[3], r[4],
          r[5] || new Date().toISOString(), ordenR + i];
      });
      // Fila COMPLETA de cada actividad (tipo, desglose, rúbrica y su mapa
      // incluidos); la rúbrica se reapunta a la copia recién importada.
      var filasA = (d.actividades || []).filter(function (r) { return mapa[r[1]]; })
        .map(function (r) { return [nuevo('act', r[0]), mapa[r[1]], r[2], r[3], r[4], r[5],
          r[6] || 'items', r[7] || '', r[8] ? nuevo('rub', r[8]) : '', r[9] || '']; });
      var filasN = (d.notas || []).filter(function (r) { return mapa[r[0]]; })
        .map(function (r) {
          var items = {};
          try { items = JSON.parse(r[1] || '{}') || {}; } catch (e) {}
          var out = {};
          Object.keys(items).forEach(function (actId) {
            if (!mapa[actId]) return; // actividad no incluida: se descarta
            var m = items[actId] || {}, mm = {};
            Object.keys(m).forEach(function (alId) {
              if (mapa[alId]) mm[mapa[alId]] = m[alId];
            });
            out[mapa[actId]] = mm;
          });
          // Re-cifra las observaciones con la clave de quien recibe.
          return [mapa[r[0]], JSON.stringify(Notas.cifrarTextos_(out))];
        });

      anexar_(ss, HOJAS.CLASES, filasC);
      anexar_(ss, HOJAS.EVALUACIONES, filasE);
      anexar_(ss, HOJAS.UNIDADES, filasU);
      anexar_(ss, HOJAS.RUBRICAS, filasR);
      anexar_(ss, HOJAS.ACTIVIDADES, filasA);
      anexar_(ss, HOJAS.NOTAS, filasN);
      // Grupos propios coincidentes: se archivan (nunca se borran) para que el
      // traspaso recién recibido no conviva duplicado con la versión antigua.
      (archivarClaseIds || []).forEach(function (id) {
        try { Clases.archivar_(ss, id, true); } catch (e) { /* ya borrado: nada */ }
      });

      // Por si el traspaso trae filas sin curso académico: re-estampar al abrir.
      Cursos.invalidarBackfill_();

      return { grupos: filasC.length, clases: filasE.length,
        unidades: filasU.length, actividades: filasA.length,
        cursos: filasC.map(function (f) { return f[8]; }) };
    } finally {
      lock.releaseLock();
    }
  }

  /** Añade filas al final de una pestaña en una sola escritura. */
  function anexar_(ss, nombre, filas) {
    if (!filas.length) return;
    var sh = ss.getSheetByName(nombre);
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  }

  return { exportar_: exportar_, importar_: importar_ };
})();
