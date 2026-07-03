# Despliegue automático (probar desde el móvil, sin ordenador)

Con esto, el ciclo de prueba pasa a ser: **fusionar el PR → esperar ~1 minuto →
abrir la app**. El workflow `sincronizar-apps-script.yml` empuja el código al
proyecto de Apps Script en cada merge a `main` usando `clasp` (la CLI oficial).

## Las dos URLs de la app

- **`/exec`** (implementación): la URL "buena", la que usa el profesorado.
  Solo cambia cuando se actualiza la implementación.
- **`/dev`** (prueba): sirve **siempre el último código guardado** en el
  proyecto, sin crear implementación. Solo funciona para quien puede editar el
  proyecto — perfecta para probar. Se obtiene en el editor de Apps Script:
  *Implementar → Probar implementaciones*.

Guarda las dos en el móvil: pruebas en `/dev`, uso real en `/exec`.

## Configuración (una sola vez, desde un ordenador)

1. **Activa la API de Apps Script** para tu cuenta:
   [script.google.com/home/usersettings](https://script.google.com/home/usersettings)
   → "API de Google Apps Script" → Activar.

2. **Credenciales de clasp**: en una terminal,
   ```bash
   npx @google/clasp login
   ```
   (`npx` lo ejecuta sin instalar nada globalmente — evita el error EACCES de
   permisos en macOS. Abre el navegador; inicia sesión con la cuenta dueña del
   proyecto.)
   Copia el contenido del archivo `~/.clasprc.json` que se acaba de crear;
   en Mac, lo más cómodo: `open -e ~/.clasprc.json` y copiar desde TextEdit.

3. **ID del proyecto**: editor de Apps Script → ⚙️ *Configuración del
   proyecto* → **ID de secuencia de comandos**.

4. **(Opcional) ID de la implementación**: *Implementar → Gestionar
   implementaciones* → copia el **ID de implementación** de la activa.
   - Con este secreto, cada merge actualiza también la URL `/exec`
     (¡lo que ve el profesorado!). Sin él, cada merge solo actualiza el
     código del proyecto y pruebas por `/dev`; producción se sigue
     desplegando a mano cuando tú decidas.

5. **Secretos en GitHub**: repositorio → *Settings → Secrets and variables →
   Actions → New repository secret*:

   | Secreto | Valor |
   |---|---|
   | `CLASPRC_JSON` | el contenido de `~/.clasprc.json` (paso 2) |
   | `GAS_SCRIPT_ID` | el ID del proyecto (paso 3) |
   | `GAS_DEPLOYMENT_ID` | (opcional) el ID de implementación (paso 4) |

Desde ese momento, cada merge a `main` sincroniza solo. Sin los secretos, el
workflow simplemente no hace nada (no falla), así que se puede fusionar esta
configuración antes de completar los pasos.

## Notas

- `.claspignore` limita lo que viaja a Apps Script: solo `.gs`, `.html` y
  `appsscript.json` (ni `data/`, ni `docs/`, ni el README).
- El workflow también se puede lanzar a mano: pestaña *Actions →
  Sincronizar con Apps Script → Run workflow*.
- GitHub Assistant sigue funcionando igual para quien prefiera el Pull manual;
  son dos caminos al mismo sitio.
- Las credenciales de `clasp login` caducan si pasan meses sin usarse; si el
  workflow empieza a fallar con error de autenticación, repite el paso 2 y
  actualiza el secreto.
