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
  • Guarda sus clases, evaluaciones, unidades, actividades e ítems
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
Datos.gs          Cuaderno personal de cada profe (esquema + utilidades)
Clases.gs         Clases: alumnado + curso (reutilizable)
Evaluaciones.gs   Evaluaciones: una clase aplicada a un área
Unidades.gs       Unidades de cada evaluación
Actividades.gs    Actividades, ítems y datos de la rejilla
Resumen.gs        Resumen global de la clase (criterios agregados + nota final)
Exportador.gs     Regenera data/mapa-curricular.json desde la hoja completa
ui.html           Interfaz
estilos.html      CSS
cliente.html      JS de cliente
docs/
  mapa-curricular.md  Cómo montar el mapa central (Fase 0)
  despliegue.md       Sincronización con GitHub Assistant y despliegue
  guia-compañeros.md  Guía de uso para el profesorado (g.educaand.es)
  autohospedaje.md    Montar una instancia propia (otros dominios)
```

> Sincronización: se usa **Google Apps Script GitHub Assistant** (no clasp).
> El editor de Apps Script hace *Pull* de este repo (archivos en la raíz).

## Estado / hoja de ruta

- [x] **Fase 0** — Estructura del Mapa Curricular central (`docs/mapa-curricular.md`)
- [x] **Fase 1** — Esqueleto: Web App, login de dominio, creación del cuaderno
- [x] **Fase 2** — Clases (alumnado reutilizable) y evaluaciones (clase + área),
  con importación pegando lista o copiando de otra clase
- [x] **Fase 3** — Unidades + actividades (criterios + nº ítems) + rejilla
  alumnos × actividades + notas por criterio y de unidad en vivo
- [x] **Fase 4** — Resumen global de la clase: nota de cada criterio agregando
  todas las unidades, nota por unidad y nota final; copiable para Séneca
- [~] **Fase 5** — Pulido visual (hecho) + despliegue y reparto (en curso)

## Cómo se reparte (importante)

Es una **única Web App**: tú la despliegas una vez con acceso de dominio y el
profesorado solo abre **una URL**. No hay copias ni plantillas por profe → cuando
actualizas el código y re-despliegas, **todos usan la versión nueva**. Los datos
de cada profe viven en **su propio Drive** (privados).

- **Profesorado de `g.educaand.es`**: usa tu URL. Ver **`docs/guia-compañeros.md`**.
- **Otros dominios/centros** que quieran instancia propia: **`docs/autohospedaje.md`**.

## Puesta en marcha (administrador)

Ver **`docs/despliegue.md`**: con **GitHub Assistant**, *Pull* de los archivos de
la raíz al proyecto de Apps Script y desplegar como Web App para el dominio. El
mapa se sirve como JSON público desde este repo (`MAPA_JSON_URLS`), no hace falta
crear hoja.
