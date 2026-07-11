# EvaluAnda — Evaluación por Criterios

**EvaluAnda** es una Web App (Google Apps Script) para evaluar por criterios de
evaluación al estilo de iDoceo, pensada para usarse por todo el dominio
**g.educaand.es**. El nombre visible es configurable (`Config.gs` →
`NOMBRE_APP`): otras comunidades o centros pueden montar su instancia con su
propia marca (ver `docs/autohospedaje.md`).

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
Config.gs         Único sitio a configurar (URLs del mapa, nombres, versión de esquema)
Code.gs           Entrada de la Web App (doGet) y estado inicial
Curriculo.gs      Lectura del Mapa Curricular central (JSON públicos, con caché)
Datos.gs          Cuaderno personal de cada profe (esquema + utilidades)
Clases.gs         Grupos: alumnado + curso (reutilizable), con bajas/reincorporación
Evaluaciones.gs   Clases: un grupo aplicado a un área
Unidades.gs       Unidades de cada clase
Actividades.gs    Actividades (tipos de columna) y datos de la rejilla
Notas.gs          Notas por unidad (blob JSON; observaciones cifradas)
Resumen.gs        Resumen global de la clase (criterios agregados + nota final)
Cursos.gs         Cursos académicos (multi-curso en un solo cuaderno)
Promocion.gs      Promocionar un grupo al curso siguiente (remapeo de criterios)
Papelera.gs       Papelera de borrados (restaurables 30 días)
Planner.gs        Planificador de sesiones (en pruebas, tras FLAGS.planner)
Cripto.gs         Cifrado en reposo de datos personales (nombres, observaciones)
Respaldo.gs       Copia de seguridad automática diaria en el Drive del profe
Portabilidad.gs   Exportar/importar la copia personal completa (JSON)
Traspaso.gs       Traspaso de grupos elegidos entre docentes (aditivo)
Exportador.gs     Regenera data/mapa-curricular.json desde la hoja completa
ui.html           Interfaz
estilos.html      CSS
cliente.html      JS de cliente
docs/
  mapa-curricular.md  Cómo montar el mapa central (Fase 0)
  despliegue.md       Sincronización con GitHub Assistant y despliegue
  despliegue-automatico.md  Merge a main → Apps Script solo (probar desde el móvil)
  guia-compañeros.md  Guía de uso para el profesorado (g.educaand.es)
  autohospedaje.md    Montar una instancia propia (otros dominios)
```

> Sincronización: cada merge a `main` sube el código a Apps Script con **clasp**
> vía GitHub Actions (`docs/despliegue-automatico.md`). El **GitHub Assistant**
> (Pull manual desde el editor) sigue sirviendo como camino alternativo.

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
- [~] **Planificador** (en pruebas, tras `FLAGS.planner`) — sesiones con
  contenido compartido (título, descripción, criterios) asignables a varias
  clases del mismo nivel, cada una con su fecha y su estado
  (pendiente/hecha/aplazada). Vista semanal y por clase; exportación en
  Markdown al portapapeles (imprimir, documentar o dar contexto a una IA).
  Con horario semanal por clase (días lectivos L–V + hora opcional): la vista
  semanal enseña los huecos sin sesión de cada día («+ Planificar») y al
  asignar una sesión se sugiere la próxima fecha en que toque esa clase. A
  principio de curso puedes **añadir una clase con solo su nombre** (sin grupo
  todavía): aparece ya en «Clases» y en el planificador; al pulsarla en
  «Clases» te pide asignar (o crear) el grupo y elegir el área, y si el grupo
  aún no tiene alumnado te ofrece incluirlo. Así el flujo es horario →
  planificar → (más adelante) grupos y evaluación.

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
