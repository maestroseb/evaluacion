/**
 * Promocionar al nuevo curso: duplica un grupo en otro curso académico,
 * reutilizando su estructura (clases, unidades y actividades) SIN notas. El
 * alumnado se copia con ids nuevos, de modo que el grupo nuevo empieza limpio y
 * el profe solo tiene que ajustar la lista (altas/bajas del curso siguiente).
 */

/** Duplica el grupo `claseId` en `cursoDestino`. Devuelve {clase, curso}. */
function promocionarGrupo(claseId, cursoDestino) {
  return Promocion.grupo_(abrirCuaderno_(), claseId, cursoDestino);
}


var Promocion = (function () {

  function grupo_(ss, claseId, cursoDestino) {
    if (!cursoDestino || !String(cursoDestino).trim()) {
      throw new Error('Falta el curso académico de destino.');
    }
    cursoDestino = String(cursoDestino).trim();
    var orig = Clases.obtener_(ss, claseId);
    if (!orig) throw new Error('Grupo no encontrado.');
    if (orig.cursoAcademico === cursoDestino) {
      throw new Error('El grupo ya está en ese curso académico.');
    }

    // Alumnado con los mismos nombres pero ids nuevos: sin notas heredadas.
    var alumnos = (orig.alumnos || []).map(function (a) { return { nombre: a.nombre }; });
    var nueva = Clases.crear_(ss, {
      nombre: orig.nombre, curso: orig.curso, alumnos: alumnos,
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
        Unidades.listar_(ss, ev.evalId).forEach(function (u) {
          var nu = Unidades.crear_(ss, nEval.evalId, u.nombre);
          Actividades.listar_(ss, u.unidadId).forEach(function (a) {
            Actividades.crear_(ss, nu.unidadId, {
              nombre: a.nombre, criterios: a.criterios, numItems: a.numItems
            });
          });
        });
      });

    return { clase: nueva, curso: cursoDestino };
  }

  return { grupo_: grupo_ };
})();
