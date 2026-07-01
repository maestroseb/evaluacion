# Notas por unidad (`_notas`) — despliegue, verificación y rollback

Cambio de fondo en el guardado de notas: se pasa de una hoja global fila-a-fila
(`_items`, una fila por nota) a **un bloque JSON por unidad** en la pestaña
`_notas`:

```
_notas:  [ unidadId, items ]      items = { actividadId: { alumnoId: valor } }
```

**Por qué:** con `_items`, guardar una nota leía/escaneaba la hoja **entera**
(coste proporcional a *todas* las notas del cuaderno) y el pegado **reescribía
toda la hoja** (lento y con riesgo de corromper datos de otras unidades/años).
Con `_notas`, guardar/leer toca **solo esa unidad** (coste independiente del
total), sin reescribir nada ajeno y con `LockService` (sin condiciones de
carrera). Escala aunque acumules cursos.

`_items` **se conserva intacto** como copia de seguridad congelada tras migrar.

## Despliegue

1. **Copia manual del cuaderno** (Archivo → Hacer una copia), además de la
   automática. Idealmente, prueba primero sobre esa copia.
2. Sincroniza el código nuevo (GitHub Assistant → Pull) y **redespliega** la
   Web App (ver `despliegue.md`).
3. **Auto-migración**: al abrir la app por primera vez tras actualizar,
   `getEstadoInicial` llama a `Migracion.auto_()`, que:
   - hace una **copia de seguridad** (`Respaldo.ahora_`),
   - reconstruye `_notas` a partir de `_items`,
   - marca el flag `notasMigradas` en `_meta` (idempotente: no se repite).
   Es transparente: no hay que abrir el editor ni ejecutar nada a mano.

> Si prefieres migrar a mano antes de abrir la app, ejecuta desde el editor
> `migrarNotasAUnidad()`. Devuelve un resumen (unidades y notas migradas).

## Verificación (hazla sobre la copia primero)

- Abrir varias unidades y comprobar que **todas las notas están** y coinciden.
- Teclear una nota (se guarda sola ~0,5 s después o al salir de la unidad).
- **Pegar** un bloque desde una hoja.
- **Borrar** y **restaurar** una actividad y una unidad desde la Papelera.
- Abrir el **Resumen** y **Copiar para Séneca**: los valores deben cuadrar.
- (Opcional) En `_notas` verás una fila por unidad con su JSON; en `_meta`, el
  flag `notasMigradas`.

## Rollback

Como `_items` se conserva, el rollback es seguro:

1. Ejecuta `revertirNotasAItems()` desde el editor. Reconstruye `_items` con el
   estado **actual** de `_notas` y limpia el flag `notasMigradas`.
2. Vuelve a desplegar la **versión anterior** del código (que lee/escribe
   `_items`).

Sin ese paso, un rollback perdería solo las notas escritas **después** de la
migración (mitigado por la copia automática diaria de `Respaldo`).

## Funciones de mantenimiento (editor de Apps Script)

| Función | Qué hace |
|---|---|
| `migrarNotasAUnidad()` | Migra `_items → _notas` (con copia previa). No repite si ya migró. |
| `migrarNotasAUnidadForzado()` | Rehace `_notas` desde `_items`. **Pisa** ediciones posteriores; usar con cuidado. |
| `revertirNotasAItems()` | Reconstruye `_items` desde `_notas` (rollback). |

## Notas de implementación

- `Notas.gs`: acceso al blob (`leer_`, `guardar_` con lock, `borrar_`,
  `quitarActividad_`).
- `Actividades.gs`: la rejilla lee el blob; borrar una actividad quita su clave.
- `Resumen.gs`: agrega leyendo los blobs de las unidades de la evaluación.
- `Papelera.gs`: fotografía `_notas` (unidad) y `_notasAct` (actividad).
- Cliente: guardado del bloque de la unidad con *debounce* (~0,5 s) y *flush*
  al navegar, al ver el Resumen y al cerrar la pestaña.
