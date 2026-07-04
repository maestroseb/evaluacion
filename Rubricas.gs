/**
 * Banco de rúbricas del profe (v12). Una rúbrica es reutilizable: se guarda una
 * vez en el banco y luego se puede enganchar en cualquier columna de tipo
 * "rúbrica" dentro de las unidades.
 *
 * Modelo de una rúbrica:
 *   - indicadores: [{ texto, peso, criterios:[] }]
 *       Las filas de la rúbrica. 'peso' pondera su aporte a la nota. El campo
 *       'criterios' de cada indicador queda RESERVADO para la futura asociación
 *       por indicador (hoy no se usa; se conserva para no volver a migrar).
 *   - niveles:     [{ etiqueta, valor }]
 *       La escala común (p. ej. Insuficiente=0 … Excelente=10).
 *   - criterios:   [codigo, …]
 *       Criterios de evaluación asociados a la rúbrica COMPLETA (opcional). Al
 *       enganchar la rúbrica en una columna, prerrellenan los criterios de esa
 *       columna; si el área coincide, puntúan con el motor que ya existe.
 *
 * Las rúbricas son contenido pedagógico (no datos personales del alumnado), así
 * que se guardan en claro, sin cifrar.
 *
 * Funciones públicas (sin guion bajo) = invocables desde el frontend.
 */

/** payload: {nombre, indicadores:[{texto,peso,criterios?}], niveles:[{etiqueta,valor}], criterios:[codigos]} */
function crearRubrica(payload) {
  return Rubricas.crear_(abrirCuaderno_(), payload);
}

/** Lista ligera del banco (para la barra lateral y el selector de columna). */
function listarRubricas() {
  return Rubricas.listar_(abrirCuaderno_());
}

/** Rúbrica completa (indicadores + niveles) para verla o evaluarla. */
function obtenerRubrica(rubricaId) {
  return Rubricas.obtener_(abrirCuaderno_(), rubricaId);
}

function editarRubrica(rubricaId, payload) {
  return Rubricas.editar_(abrirCuaderno_(), rubricaId, payload);
}

function eliminarRubrica(rubricaId) {
  return Rubricas.eliminar_(abrirCuaderno_(), rubricaId);
}

/** Duplica una rúbrica (mismo contenido, nuevo id). */
function duplicarRubrica(rubricaId) {
  return Rubricas.duplicar_(abrirCuaderno_(), rubricaId);
}

/** Reordena el banco según el nuevo orden de ids. */
function reordenarRubricas(ids) {
  return Rubricas.reordenar_(abrirCuaderno_(), ids);
}


var Rubricas = (function () {

  function hoja_(ss) { return ss.getSheetByName(HOJAS.RUBRICAS); }

  /**
   * Lista ligera: lo justo para pintar el banco y el selector de columna. No
   * devuelve los niveles completos (eso lo da obtener_ al abrir/evaluar).
   */
  function listar_(ss) {
    var datos = hoja_(ss).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var f = datos[i];
      if (!f[0]) continue;
      var indicadores = parse_(f[2]);
      out.push({
        rubricaId: f[0], nombre: f[1],
        numIndicadores: indicadores.length,
        numNiveles: parse_(f[3]).length,
        criterios: parse_(f[4]),
        creado: f[5], orden: Number(f[6]) || 0
      });
    }
    out.sort(function (a, b) { return a.orden - b.orden; });
    return out;
  }

  function obtener_(ss, rubricaId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, rubricaId);
    if (fila < 0) throw new Error('Rúbrica no encontrada.');
    var f = sh.getRange(fila, 1, 1, 7).getValues()[0];
    return {
      rubricaId: f[0], nombre: f[1],
      indicadores: parse_(f[2]), niveles: parse_(f[3]),
      criterios: parse_(f[4]), creado: f[5], orden: Number(f[6]) || 0
    };
  }

  function crear_(ss, payload) {
    var limpio = validarYNormalizar_(payload);
    var id = Datos.nuevoId_('rub');
    var orden = Datos.siguienteOrden_(listar_(ss));
    hoja_(ss).appendRow([
      id, limpio.nombre, JSON.stringify(limpio.indicadores),
      JSON.stringify(limpio.niveles), JSON.stringify(limpio.criterios),
      new Date().toISOString(), orden
    ]);
    return obtener_(ss, id);
  }

  function editar_(ss, rubricaId, payload) {
    var limpio = validarYNormalizar_(payload);
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, rubricaId);
    if (fila < 0) throw new Error('Rúbrica no encontrada.');
    // cols 2-5 = nombre, indicadores, niveles, criterios (no toca creado ni orden)
    sh.getRange(fila, 2, 1, 4).setValues([[
      limpio.nombre, JSON.stringify(limpio.indicadores),
      JSON.stringify(limpio.niveles), JSON.stringify(limpio.criterios)
    ]]);
    return obtener_(ss, rubricaId);
  }

  function eliminar_(ss, rubricaId) {
    Papelera.papelearRubrica_(ss, rubricaId); // a la papelera antes de borrar
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, rubricaId);
    if (fila < 0) return { ok: true };
    sh.deleteRow(fila);
    return { ok: true };
  }

  function duplicar_(ss, rubricaId) {
    var orig = obtener_(ss, rubricaId);
    return crear_(ss, {
      nombre: orig.nombre + ' (copia)', indicadores: orig.indicadores,
      niveles: orig.niveles, criterios: orig.criterios
    });
  }

  /** Reescribe la columna 'orden' (col 7) según la posición de cada id, en una escritura. */
  function reordenar_(ss, ids) {
    if (!ids || !ids.length) return { ok: true };
    var sh = hoja_(ss);
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) return { ok: true };
    var idCol = sh.getRange(2, 1, n, 1).getValues();
    var ordenCol = sh.getRange(2, 7, n, 1).getValues();
    var pos = {};
    ids.forEach(function (id, idx) { pos[id] = idx + 1; });
    for (var i = 0; i < n; i++) {
      var id = idCol[i][0];
      if (id && pos[id] != null) ordenCol[i][0] = pos[id];
    }
    sh.getRange(2, 7, n, 1).setValues(ordenCol);
    return { ok: true };
  }

  // ---------- validación / normalización ----------

  /**
   * Deja el payload en forma canónica y valida lo imprescindible: nombre, al
   * menos un indicador y una escala de niveles válida. Blinda tipos (pesos y
   * valores numéricos, listas de criterios como strings) para que la hoja no
   * guarde basura venida del cliente.
   */
  function validarYNormalizar_(payload) {
    var nombre = String((payload && payload.nombre) || '').trim();
    if (!nombre) throw new Error('Falta el nombre de la rúbrica.');

    var indicadores = (Array.isArray(payload.indicadores) ? payload.indicadores : [])
      .map(function (ind) {
        return {
          texto: String((ind && ind.texto) || '').trim(),
          peso: pesoValido_(ind && ind.peso),
          celdas: celdas_(ind && ind.celdas),       // descripción de cada nivel
          criterios: codigos_(ind && ind.criterios) // reservado (asociación por indicador)
        };
      })
      .filter(function (ind) { return ind.texto; });
    if (!indicadores.length) throw new Error('La rúbrica necesita al menos un indicador.');

    var niveles = (Array.isArray(payload.niveles) ? payload.niveles : [])
      .map(function (n) {
        return { etiqueta: String((n && n.etiqueta) || '').trim(), valor: Number(n && n.valor) || 0 };
      })
      .filter(function (n) { return n.etiqueta; });
    if (niveles.length < 2) throw new Error('La escala de niveles necesita al menos dos niveles.');

    return {
      nombre: nombre, indicadores: indicadores, niveles: niveles,
      criterios: codigos_(payload.criterios) // asociación a la rúbrica completa
    };
  }

  /** Descripciones de cada nivel de un indicador: cadenas acotadas (una por nivel). */
  function celdas_(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (c) {
      return String(c == null ? '' : c).slice(0, 2000);
    });
  }

  /** Peso del indicador (porcentaje 0–100). Se admite 0; los negativos → 0. */
  function pesoValido_(v) {
    var p = Number(v);
    return (isFinite(p) && p >= 0) ? p : 0;
  }

  /** Lista de códigos de criterio: strings recortados, sin vacíos ni duplicados. */
  function codigos_(lista) {
    var out = [], vistos = {};
    (Array.isArray(lista) ? lista : []).forEach(function (c) {
      var cod = String(c || '').trim();
      if (cod && !vistos[cod]) { vistos[cod] = true; out.push(cod); }
    });
    return out;
  }

  function parse_(json) {
    if (!json) return [];
    try { var v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  return {
    listar_: listar_, obtener_: obtener_, crear_: crear_, editar_: editar_,
    eliminar_: eliminar_, duplicar_: duplicar_, reordenar_: reordenar_
  };
})();
