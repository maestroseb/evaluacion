/**
 * Configuración global de la aplicación.
 *
 * IMPORTANTE: este es el ÚNICO sitio donde hay que tocar valores al desplegar.
 */
var CONFIG = {
  // Nombre del cuaderno personal que se crea en el Drive de cada profe.
  NOMBRE_CUADERNO: 'Evaluación por Criterios — Cuaderno',

  // Mapa curricular servido como JSON público desde GitHub. Es la fuente
  // principal: no requiere permisos de Drive y se sirve igual a toda la
  // comunidad. El repositorio debe ser público (o el JSON accesible por URL).
  MAPA_JSON_URL: 'https://raw.githubusercontent.com/maestroseb/evaluacion/' +
    'claude/sheets-evaluation-criteria-3qsyay/data/mapa-curricular.json',

  // Alternativa/legado: hoja de cálculo central con el mapa. Solo se usa si
  // MAPA_JSON_URL está vacío. Se compartiría en solo lectura con el dominio.
  MAPA_CURRICULAR_ID: '1raqUsR_J2iTBJQV5OevluUTy5R7eKS4WWI0IF6Bpip0',

  // Versión del esquema de datos del cuaderno. Permite migraciones futuras.
  // v2: campo "icono" en las evaluaciones (icono SVG por clase).
  // v3: campo "nombre" en las evaluaciones (título editable, por defecto el área).
  // v4: campos "color" e "icono" en los grupos (_clases).
  // v5: notas por unidad en _notas (un JSON por unidad); _items pasa a ser
  //     copia de seguridad congelada tras la migración.
  // v6: campo "orden" en evaluaciones y grupos (reordenar tarjetas arrastrando).
  ESQUEMA_VERSION: 6
};

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
  ITEMS: '_items',        // (legado) ítems fila-a-fila; copia congelada tras migrar
  NOTAS: '_notas',        // notas por unidad: un JSON {act:{alumno:valor}} por fila
  PAPELERA: '_papelera'   // elementos borrados, restaurables un tiempo
};
