/**
 * Configuración global de la aplicación.
 *
 * IMPORTANTE: este es el ÚNICO sitio donde hay que tocar valores al desplegar.
 */
var CONFIG = {
  // Nombre visible de la aplicación: título de la pestaña, marca de la barra
  // lateral y nombre del cuaderno de Drive. Quien monte una instancia para
  // otra comunidad o centro solo tiene que cambiar esta línea (y el mapa).
  NOMBRE_APP: 'EvaluAnda',

  // Mapa curricular servido como JSON público desde GitHub. Es la fuente
  // principal: no requiere permisos de Drive y se sirve igual a toda la
  // comunidad. El repositorio debe ser público (o los JSON accesibles por URL).
  // Cada etapa vive en su propio fichero (se regeneran de hojas distintas) y
  // la app los descarga y fusiona: un único despliegue sirve a todas.
  MAPA_JSON_URLS: [
    'https://raw.githubusercontent.com/maestroseb/evaluacion/main/data/mapa-curricular.json',
    'https://raw.githubusercontent.com/maestroseb/evaluacion/main/data/mapa-secundaria.json'
  ],

  // Alternativa/legado: hoja de cálculo central con el mapa. Solo se usa si
  // MAPA_JSON_URLS está vacío. Se compartiría en solo lectura con el dominio.
  MAPA_CURRICULAR_ID: '1raqUsR_J2iTBJQV5OevluUTy5R7eKS4WWI0IF6Bpip0',

  // Versión del esquema de datos del cuaderno. Permite migraciones futuras.
  // v2: campo "icono" en las evaluaciones (icono SVG por clase).
  // v3: campo "nombre" en las evaluaciones (título editable, por defecto el área).
  // v4: campos "color" e "icono" en los grupos (_clases).
  // v5: notas por unidad en _notas (un JSON por unidad); _items pasa a ser
  //     copia de seguridad congelada tras la migración.
  // v6: campo "orden" en evaluaciones y grupos (reordenar tarjetas arrastrando).
  // v7: campo "cursoAcademico" en evaluaciones y grupos (multi-curso en un solo
  //     cuaderno; la interfaz filtra por el curso académico activo).
  // v8: se retira la pestaña legado _items (las notas viven solo en _notas). La
  //     migración _items→_notas ya no forma parte del código.
  // v9: columna "bajas" en _clases: alumnado retirado de la lista (id + nombre
  //     cifrado). Si se re-añade a alguien con el mismo nombre, recupera su id
  //     y con él todas sus notas (reincorporación).
  // v10: columna "tipo" en _actividades: tipos de columna en la rejilla
  //      (items = actual, nota directa, check, contador, escalas IN-SB y
  //      POC-EXC, y "texto" = observación libre, siempre informativa; el blob
  //      de _notas admite cadenas para ese tipo). Los criterios pueden ir
  //      vacíos en cualquier tipo (columna informativa: no cuenta).
  // v11: columna "desglose" en _actividades: con varios criterios, la actividad
  //      puede llevar nota independiente por criterio; el blob de _notas guarda
  //      entonces un objeto {criterio: valor} en vez de un número.
  // v12: pestaña "_rubricas": banco de rúbricas del profe (indicadores, niveles
  //      y, opcionalmente, criterios de evaluación asociados). Migración no
  //      destructiva: solo añade la pestaña; ningún dato existente se toca. La
  //      superficie de UI va oculta tras la bandera FLAGS.rubricas.
  // v13: columna "rubricaId" en _actividades: una columna de tipo "rubrica" se
  //      engancha a una rúbrica del banco. El blob de _notas guarda, para ese
  //      tipo, el nivel elegido por indicador; la nota /10 se calcula al vuelo.
  // v14: columna "rubMap" en _actividades: mapa criterio↔indicador de una
  //      columna rúbrica. Vacío = criterios globales (toda la rúbrica → los
  //      criterios de la columna); con contenido = un criterio por indicador
  //      (JSON: un código por posición de indicador). Así una misma rúbrica se
  //      asocia a criterios distintos según el área de la clase.
  // v15: columna "archivado" en _clases y _evaluaciones: quitar de la vista sin
  //      eliminar. Un grupo archivado oculta también sus clases (derivado, sin
  //      tocar sus filas); una clase puede archivarse suelta. Restaurable desde
  //      la sección "Archivados" de cada lista.
  // v16: pestaña "_planner": planificador de sesiones del profe. Una sesión es
  //      contenido reutilizable (título, descripción, criterios) con
  //      asignaciones por clase (evalId + fecha + estado): la misma
  //      planificación sirve para varios grupos del mismo nivel y cada uno
  //      avanza a su ritmo. Migración no destructiva: solo añade la pestaña.
  //      La superficie de UI va oculta tras la bandera FLAGS.planner.
  // v17: columna "horario" en _evaluaciones: días de la semana (y hora
  //      opcional) en que se imparte cada clase (JSON [{dia:0-6, hora}],
  //      0 = lunes). Lo usa el planificador para enseñar los huecos sin
  //      sesión de cada día y sugerir fechas al asignar.
  // v18: pestaña "_provisionales": clases provisionales del planificador (solo
  //      nombre, sin grupo ni alumnado), para montar el horario y planificar
  //      ANTES de crear grupos y clases (principio de curso). Al vincularlas a
  //      una clase real, su horario y sus sesiones pasan a ella.
  // v19: una clase (evaluación) puede existir SIN grupo y sin área todavía:
  //      se crea desde el planificador y se completa (grupo + área) al pulsarla
  //      en "Clases". Sustituye a las clases provisionales, que se migran solas
  //      a clases reales sin grupo (conservando su horario y sus sesiones); la
  //      pestaña _provisionales queda vacía tras la migración.
  ESQUEMA_VERSION: 19,

  // Banderas de funcionalidad. Cada bandera es la lista de correos que la ven
  // (o '*' para todo el profesorado). Sirve para lanzar módulos "ocultos": se
  // despliega el código pero solo lo ve quien esté en la lista, hasta que se
  // decida abrirlo a todos cambiando su valor por '*' (sin re-desplegar nada).
  FLAGS: {
    // Módulo de rúbricas: ABIERTO a todo el profesorado desde julio de 2026
    // (probado en privado con la lista de correos que hubo aquí hasta entonces).
    rubricas: '*',
    // Planificador de sesiones: EN PRUEBAS, solo lo ve esta lista de correos.
    planner: ['sgirjim495@g.educaand.es']
  }
};

// Nombre del cuaderno personal que se crea en el Drive de cada profe. Deriva
// del nombre de la app; los cuadernos ya creados conservan su nombre (la app
// los localiza por id, no por nombre).
CONFIG.NOMBRE_CUADERNO = CONFIG.NOMBRE_APP + ' — Cuaderno';

/**
 * Nombres internos de las pestañas del cuaderno personal de cada profe.
 * El profe nunca las abre a mano: son solo el almacén de datos.
 */
var HOJAS = {
  META: '_meta',          // versión de esquema, fecha de creación, dueño
  CLASES: '_clases',      // clases: lista de alumnado + curso (reutilizable)
  EVALUACIONES: '_evaluaciones', // clase + área concreta a evaluar
  UNIDADES: '_unidades',  // unidades de cada evaluación
  ACTIVIDADES: '_actividades', // actividades de cada unidad y sus criterios
  NOTAS: '_notas',        // notas por unidad: un JSON {act:{alumno:valor}} por fila
  PAPELERA: '_papelera',  // elementos borrados, restaurables un tiempo
  RUBRICAS: '_rubricas',  // banco de rúbricas del profe (indicadores + niveles)
  PLANNER: '_planner',    // planificador de sesiones (asignables a varias clases)
  PROVISIONALES: '_provisionales' // clases provisionales del planificador (solo nombre)
};
