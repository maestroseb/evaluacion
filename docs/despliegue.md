# Despliegue (paso a paso)

El código se versiona aquí, en Git, en formato **clasp** (los `.gs`/`.html` de
Apps Script). El `clasp push` y el despliegue final los haces **tú** desde tu
cuenta de Google, porque solo tú tienes acceso a tu Workspace.

## Requisitos (una vez)

```bash
npm install -g @google/clasp
clasp login          # inicia sesión con tu cuenta g.educaand.es
```

> Si el dominio tiene bloqueada la API de Apps Script, un administrador debe
> activar "Google Apps Script API" en https://script.google.com/home/usersettings

## Primer despliegue

1. Crea el proyecto y enlázalo a esta carpeta:
   ```bash
   clasp create --type webapp --title "Evaluación por Criterios" --rootDir src
   ```
   Esto genera un `.clasp.json` (ignorado por Git) con tu `scriptId`.
   Como referencia tienes `.clasp.json.example`.

2. Crea el **Mapa Curricular** siguiendo `docs/mapa-curricular.md` y pega su ID
   en `src/Config.gs` → `MAPA_CURRICULAR_ID`.

3. Sube el código:
   ```bash
   clasp push
   ```

4. Despliega como Web App:
   ```bash
   clasp deploy --description "v1"
   ```
   O desde el editor: **Implementar → Nueva implementación → Aplicación web**
   - *Ejecutar como*: **Usuario que accede a la aplicación web**
   - *Quién tiene acceso*: **Cualquier usuario de g.educaand.es**

5. Comparte la URL de la Web App con tus compañeros. Cada uno, al entrar por
   primera vez, autoriza los permisos y se le crea su cuaderno automáticamente.

## Actualizaciones posteriores

```bash
clasp push
clasp deploy --deploymentId <ID>   # re-despliega la MISMA URL
```

Como la lógica y el mapa son centrales, basta con que tú actualices: todos los
profes usan la última versión sin tocar nada.
