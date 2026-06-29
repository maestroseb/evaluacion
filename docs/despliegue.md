# Despliegue con Google Apps Script GitHub Assistant

El código se versiona aquí, en Git. Con la extensión **Google Apps Script
GitHub Assistant** sincronizas el editor de Apps Script con este repositorio
directamente, sin `clasp`.

## Requisitos (una vez)

1. Instala la extensión **Google Apps Script GitHub Assistant** en Chrome.
2. En el editor de Apps Script aparecerá una barra con botones de GitHub.
   Autoriza tu cuenta de GitHub cuando lo pida.

## Primer despliegue

1. Crea un proyecto nuevo en https://script.google.com (tipo: independiente).
2. En la barra del Assistant, selecciona:
   - **Repository**: `maestroseb/evaluacion`
   - **Branch**: `claude/sheets-evaluation-criteria-3qsyay`
   - **Directory / Path**: `src`  ← donde viven los `.gs`/`.html` y el manifiesto
     (si prefieres tenerlo en la raíz del repo, pídelo y muevo los archivos).
3. Pulsa **Pull** para traer todos los archivos del repo al proyecto.
4. Activa "Mostrar manifiesto appsscript.json" en la configuración del editor
   de Apps Script para que se sincronice también `appsscript.json`.
5. Crea el **Mapa Curricular** siguiendo `docs/mapa-curricular.md` y pega su ID
   en `src/Config.gs` → `MAPA_CURRICULAR_ID`.
6. Despliega como Web App: **Implementar → Nueva implementación →
   Aplicación web**
   - *Ejecutar como*: **Usuario que accede a la aplicación web**
   - *Quién tiene acceso*: **Cualquier usuario de g.educaand.es**
7. Comparte la URL con tus compañeros. Cada uno, al entrar la primera vez,
   autoriza permisos y se le crea su cuaderno automáticamente.

## Flujo de trabajo habitual

- **Yo** hago cambios y los subo a la rama del repo.
- **Tú** abres el proyecto en Apps Script y pulsas **Pull** en el Assistant
  para traer la última versión.
- Si tú tocas algo en el editor, pulsa **Push** para guardarlo en el repo.

> Recomendación: edita siempre desde el repo (vía nuestra conversación) y usa el
> Assistant solo para **Pull**, para no crear conflictos.

Como la lógica y el mapa son centrales, basta con que tú actualices el proyecto:
todos los profes usan la última versión sin tocar nada.
