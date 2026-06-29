# Mapa Curricular central (Fase 0)

El mapa curricular es la **única fuente de verdad** de competencias y criterios.
Lo mantienes tú; los profes solo lo leen. Al estar centralizado, cualquier
corrección llega a todos sin que ellos hagan nada.

## Cómo crearlo

1. Crea una hoja de cálculo nueva llamada **`Mapa Curricular`**.
2. Crea dentro una pestaña llamada exactamente **`Mapa`**.
3. Pon esta cabecera en la fila 1 y rellena una fila por criterio:

| curso | area | competencia | criterio_codigo | criterio_texto |
|-------|------|-------------|-----------------|----------------|
| 2º Primaria | Lengua Castellana y Literatura | LCL.2. Comprender e interpretar… | LCL.2.2.1 | Comprender el sentido de textos orales… |
| 2º Primaria | Lengua Castellana y Literatura | LCL.9. Reflexionar de forma guiada… | LCL.2.9.1 | Gramática |
| … | … | … | … | … |

> El formato es "largo": cada criterio en su propia fila, repitiendo curso/área.
> Es como tienes hoy la pestaña de configuración, pero normalizado para que el
> programa lo lea sin ambigüedad.

4. **Comparte** la hoja en **solo lectura** con todo el dominio
   (`Cualquier usuario de g.educaand.es con el enlace → Lector`).
5. Copia su **ID** (la parte larga de la URL) y pégalo en
   `Config.gs` → `MAPA_CURRICULAR_ID`.

## Migrar tu hoja actual

Tu pestaña de configuración ya tiene el par competencia ↔ criterio. Pasarla al
formato largo de arriba es un copia/pega + rellenar las columnas `curso` y
`area` (que son constantes para esa hoja). Cuando quieras, te genero un pequeño
script que convierte tu pestaña actual a este formato automáticamente.
