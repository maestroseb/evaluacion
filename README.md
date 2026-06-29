# Evaluación por Criterios

Web App (Google Apps Script) para evaluar por criterios de evaluación al estilo
de iDoceo, pensada para usarse por todo el dominio **g.educaand.es**.

Sustituye a la hoja de cálculo con fórmulas: el profe ya **no toca celdas**, así
que no puede romper nada sin querer. La lógica y el mapa curricular están
**centralizados**, de modo que las mejoras llegan a todos sin reinstalar.

## Idea en una frase

> La hoja de cálculo deja de ser la interfaz y pasa a ser solo el almacén de
> datos. La interfaz es una rejilla web tipo iDoceo.

## Arquitectura

```
PROYECTO CENTRAL (tu cuenta)
  • Web App Apps Script  → frontend (rejilla) + motor de cálculo
      - Ejecutar como: el usuario que accede
      - Acceso: cualquiera de g.educaand.es
  • Hoja "Mapa Curricular" (solo lectura para el dominio)

DATOS DE CADA PROFE (en su Drive)
  • Un "cuaderno" creado automáticamente la 1ª vez
  • Guarda sus grupos, alumnado, unidades, actividades e ítems
  • Privado y aislado; el profe nunca lo abre a mano
```

## Modelo de evaluación (portado de la hoja original)

```
nota_actividad = ítems_conseguidos / nº_ítems × 10
  (actividades del mismo criterio "agrupadas" → se suman sus ítems)
nota_criterio  = media de las actividades de ese criterio
nota_unidad    = media de las notas de criterio de la unidad
nota_final     = media de las notas de criterio en las unidades elegidas
```

## Estructura del repositorio

```
appsscript.json   Manifiesto (web app + scopes)
Config.gs         Único sitio a configurar (ID del mapa, nombres)
Code.gs           Entrada de la Web App (doGet) y estado inicial
Curriculo.gs      Lectura del Mapa Curricular central
Datos.gs          Cuaderno personal de cada profe (CRUD)
Grupos.gs         Grupos y alumnado (crear, editar, eliminar)
Calc.gs           Motor de cálculo de notas
ui.html           Interfaz
estilos.html      CSS
cliente.html      JS de cliente
docs/
  mapa-curricular.md  Cómo montar el mapa central (Fase 0)
  despliegue.md       Sincronización con GitHub Assistant y despliegue
```

> Sincronización: se usa **Google Apps Script GitHub Assistant** (no clasp).
> El editor de Apps Script hace *Pull* de este repo (archivos en la raíz).

## Estado / hoja de ruta

- [x] **Fase 0** — Estructura del Mapa Curricular central (`docs/mapa-curricular.md`)
- [x] **Fase 1** — Esqueleto: Web App, login de dominio, creación del cuaderno
- [x] **Fase 2** — Gestión de grupos y alumnado (manual / pegar lista)
- [ ] **Fase 3** — Unidades + actividades + rejilla de ítems + cálculo en vivo
- [ ] **Fase 4** — Resumen de unidad + resumen global + nota final
- [ ] **Fase 5** — Pulido visual tipo iDoceo y despliegue

## Puesta en marcha

Ver **`docs/despliegue.md`**. Resumen: con **GitHub Assistant**, hacer *Pull*
de los archivos de la raíz al proyecto de Apps Script, crear el Mapa y pegar su
ID en `Config.gs`, y desplegar como Web App para el dominio.
