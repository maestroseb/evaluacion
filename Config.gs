/**
 * Configuración global de la aplicación.
 *
 * IMPORTANTE: este es el ÚNICO sitio donde hay que tocar valores al desplegar.
 * Rellena MAPA_CURRICULAR_ID con el ID de tu hoja central "Mapa Curricular"
 * (la parte larga de su URL: .../spreadsheets/d/ESTE_ID/edit).
 */
var CONFIG = {
  // Nombre del cuaderno personal que se crea en el Drive de cada profe.
  NOMBRE_CUADERNO: 'Evaluación por Criterios — Cuaderno',

  // ID de la hoja central con el mapa curricular (todas las áreas/cursos).
  // Se comparte en SOLO LECTURA con todo el dominio g.educaand.es.
  MAPA_CURRICULAR_ID: '1-mVNwIHQeXYU14TDwnq4VdVZOVI2YIl9tvZbnVJgTmI',

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
