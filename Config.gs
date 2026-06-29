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
  ESQUEMA_VERSION: 1
};

/**
 * Nombres internos de las pestañas del cuaderno personal de cada profe.
 * El profe nunca las abre a mano: son solo el almacén de datos.
 */
var HOJAS = {
  META: '_meta',         // versión de esquema, fecha de creación, dueño
  GRUPOS: '_grupos',     // grupos/clases y su alumnado
  UNIDADES: '_unidades', // unidades de cada grupo
  ACTIVIDADES: '_actividades', // actividades de cada unidad y sus criterios
  ITEMS: '_items'        // ítems conseguidos por alumno y actividad
};
