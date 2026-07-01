# Cursos académicos — Parte B

> Estado: **implementado** (esquema v7). Un solo cuaderno guarda todos los
> cursos; la interfaz filtra por el curso académico activo.

## Qué se ha implementado

- Campo `cursoAcademico` en `_clases` y `_evaluaciones` (col 9, migración no
  destructiva por `asegurarColumnas_`; `ESQUEMA_VERSION` = 7).
- Módulo `Cursos` (`Cursos.gs`): `actual_()` (curso natural sep→ago),
  `activo_()`/`fijar_()` (persistido en `UserProperties.cursoActivo`),
  `lista_()`, `filtrar_()` y `backfill_()` (asigna el curso natural a los datos
  antiguos, idempotente, se llama en `getEstadoInicial`).
- `getEstadoInicial` devuelve `cursos:{activo,actual,lista}` y las listas ya
  filtradas al curso activo. `cambiarCurso(curso)` cambia el activo y devuelve
  Clases y Grupos del nuevo curso. `crearClase`/`crearEvaluacion` etiquetan lo
  nuevo con el curso activo (la clase hereda el del grupo).
- UI: selector de curso en la barra superior (`#curso-activo`); al cambiarlo se
  repintan Clases y Grupos. Botón **Promocionar** en el detalle de un grupo.
- `Promocion.gs` (`promocionarGrupo`): duplica un grupo en el curso destino con
  sus clases, unidades y actividades pero SIN notas; el alumnado se copia con
  ids nuevos (empieza limpio). Tras promocionar, la UI salta al curso destino.
- Portabilidad (export/import) incluye `cursoAcademico`.

## Diseño original (referencia)

## Decisión: un solo cuaderno + campo `cursoAcademico` (NO hojas separadas)

Una vez que las notas se guardan por unidad (`_notas`), guardar **no depende del
total del cuaderno**, así que **no hace falta** separar cada curso en pestañas ni
en ficheros distintos:

- ❌ **Una pestaña por curso**: choca con el límite de pestañas de Apps Script y
  multiplica la complejidad. Descartado.
- ❌ **Un cuaderno (fichero) por curso**: el archivado más "limpio", pero mucha
  complejidad (varios `cuadernoId`, informes entre cursos, reutilizar grupos).
  Solo si se previera un volumen enorme.
- ✅ **Un cuaderno + campo `cursoAcademico`** en clases/grupos, con la interfaz
  filtrando por el curso activo. **Recomendado.** Lo único que crece con los años
  son las listas (`_evaluaciones`, `_unidades`, `_actividades`): unos cientos de
  filas en 10 años, se escanean en milisegundos.

## Diseño

- Campo **`cursoAcademico`** (p. ej. `"2024-2025"`) en `_evaluaciones` y `_clases`.
- **Curso activo** en `UserProperties` (+ cálculo del curso actual: si mes ≥
  septiembre → `AAAA-AAAA+1`).
- **UI**: selector de curso en la barra; las listas de Clases y Grupos muestran
  solo el activo; los anteriores quedan archivados y accesibles al elegirlos.
- **"Promocionar al nuevo curso"**: duplicar un grupo/clase al curso siguiente
  (misma estructura de unidades/actividades, sin notas; el alumnado se pega nuevo).

## Pasos

1. Esquema: añadir `cursoAcademico` a `_evaluaciones` y `_clases` (migración por
   `asegurarColumnas_`). Subir `ESQUEMA_VERSION`.
2. Backend: `crear_`/`listar_`/`obtener_` guardan/devuelven el campo; filtro por
   curso; helper `cursoActual()`.
3. Cliente: selector de curso; filtrado en `pintarEvaluaciones`/`pintarClases`;
   acción "Promocionar".
4. Backfill: a lo existente se le asigna `cursoAcademico` = curso actual (una
   pasada, idempotente).

## Rollback

Cambio **aditivo** (una columna nueva). El código antiguo la ignora. Revertir =
quitar el filtro de la UI. **Cero pérdida de datos.** Riesgo bajo.
