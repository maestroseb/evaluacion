# Cursos académicos — plan (Parte B, pendiente)

> Estado: **diseñado, sin implementar.** Se hará sobre base limpia, después de
> mergear el rediseño y la mejora de notas por unidad (`docs/notas-por-unidad.md`).

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
