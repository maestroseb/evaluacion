/**
 * Promocionar al nuevo curso: duplica un grupo en otro curso académico,
 * reutilizando su estructura (clases, unidades y actividades) SIN notas. El
 * alumnado se copia con ids nuevos, de modo que el grupo nuevo empieza limpio y
 * el profe solo tiene que ajustar la lista (altas/bajas del curso siguiente).
 *
 * Si además el grupo SUBE DE NIVEL (p. ej. 4º→5º), los criterios vinculados a
 * las actividades se remapean al nivel destino sustituyendo el nivel dentro del
 * código (LCL.4.4.1 → LCL.5.4.1) y validándolos contra el catálogo del nivel
 * nuevo. Los que no tengan correspondencia se quedan sin asignar (LOMLOE no
 * garantiza equivalencia entre niveles).
 */

/**
 * Duplica el grupo `claseId` en `cursoDestino` (año académico). Si `nivelDestino`
 * cambia respecto al nivel del grupo, sube de nivel y remapea los criterios.
 * Devuelve {clase, curso, criteriosSinAsignar}.
 */
function promocionarGrupo(claseId, cursoDestino, nivelDestino) {
  return Promocion.grupo_(abrirCuaderno_(), claseId, cursoDestino, nivelDestino);
}


var Promocion = (function () {

  /** Dígito de nivel a partir del nombre del curso ("4º Primaria" → "4"). */
  function digitoNivel_(curso) {
    var m = /^\s*(\d+)/.exec(String(curso || ''));
    return m ? m[1] : '';
  }

  /**
   * Remapea una lista de criterios de un nivel a otro sustituyendo el dígito de
   * nivel (2º token del código) y conservando solo los que existan en destino.
   * Si no se puede mapear (niveles sin dígito, p. ej. Infantil) devuelve [].
   */
  function remapearCriterios_(criterios, dOrigen, dDestino, validos) {
    var out = [];
    if (!dOrigen || !dDestino) return out;
    (criterios || []).forEach(function (cod) {
      var p = String(cod).split('.');
      if (p[1] !== dOrigen) return;            // no encaja el patrón → sin asignar
      p[1] = dDestino;
      var nuevo = p.join('.');
      if (validos[nuevo]) out.push(nuevo);      // solo si existe en el nivel destino
    });
    return out;
  }

  function grupo_(ss, claseId, cursoDestino, nivelDestino) {
    if (!cursoDestino || !String(cursoDestino).trim()) {
      throw new Error('Falta el curso académico de destino.');
    }
    cursoDestino = String(cursoDestino).trim();
    var orig = Clases.obtener_(ss, claseId); // lanza si el grupo no existe

    // Nivel destino: si no se indica, se mantiene el del grupo (misma etapa).
    var nivel = (nivelDestino && String(nivelDestino).trim()) || orig.curso;
    var cambiaNivel = (nivel !== orig.curso);
    if (orig.cursoAcademico === cursoDestino && !cambiaNivel) {
      throw new Error('El grupo ya está en ese curso académico y nivel.');
    }

    var dOrigen = digitoNivel_(orig.curso);
    var dDestino = digitoNivel_(nivel);
    var validos = cambiaNivel ? Curriculo.codigosDeNivel(nivel) : null;
    var sinAsignar = 0; // criterios que no encontraron correspondencia

    // Alumnado con los mismos nombres pero ids nuevos: sin notas heredadas.
    var alumnos = (orig.alumnos || []).map(function (a) { return { nombre: a.nombre }; });
    var nueva = Clases.crear_(ss, {
      nombre: orig.nombre, curso: nivel, alumnos: alumnos,
      color: orig.color, icono: orig.icono, cursoAcademico: cursoDestino
    });

    // Duplica cada clase (evaluación) del grupo con su estructura, sin notas.
    Evaluaciones.listar_(ss)
      .filter(function (e) { return e.claseId === claseId; })
      .forEach(function (ev) {
        var nEval = Evaluaciones.crear_(ss, {
          claseId: nueva.claseId, area: ev.area, nombre: ev.nombre,
          color: ev.color, icono: ev.icono
        });
        // La evaluación y las unidades nuevas nacen vacías: el orden es el índice
        // de cada elemento, así crear_ no relee la hoja en cada iteración (O(n)).
        Unidades.listar_(ss, ev.evalId).forEach(function (u, ui) {
          var nu = Unidades.crear_(ss, nEval.evalId, u.nombre, ui + 1);
          Actividades.listar_(ss, u.unidadId).forEach(function (a, ai) {
            var criterios = a.criterios || [];
            if (cambiaNivel) {
              var remap = remapearCriterios_(criterios, dOrigen, dDestino, validos);
              sinAsignar += (criterios.length - remap.length);
              criterios = remap;
            }
            Actividades.crear_(ss, nu.unidadId, {
              nombre: a.nombre, criterios: criterios, numItems: a.numItems
            }, cambiaNivel, ai + 1); // al subir de nivel se permite quedar sin criterios
          });
        });
      });

    return { clase: nueva, curso: cursoDestino, nivel: nivel, criteriosSinAsignar: sinAsignar };
  }

  return { grupo_: grupo_ };
})();
