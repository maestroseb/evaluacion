# Montar tu propia instancia (otros centros / dominios)

Quien **no** sea de `g.educaand.es` (u otro centro/dominio que quiera su propia
instalación independiente) puede desplegar su **propia copia** de la aplicación.
Cada instancia es autónoma: su propio despliegue, sus propios usuarios y los
datos de cada profe en su propio Drive.

> Importante: esto es **replicar la app**, no "una copia por profe". Dentro de tu
> propia instancia, tu profesorado sigue usando **una única URL** (la tuya) y se
> les actualiza a todos cuando tú actualizas tu despliegue.

## Requisitos

- Una cuenta de Google (idealmente de tu dominio Workspace).
- La extensión **Google Apps Script GitHub Assistant** (o `clasp`).

## Pasos

1. Crea un proyecto en https://script.google.com (**Nuevo proyecto**, tipo
   independiente).
2. Con el **GitHub Assistant**, haz **Pull** de este repositorio
   (`maestroseb/evaluacion`, rama indicada) con los archivos en la **raíz**.
   Activa la sincronización del manifiesto `appsscript.json`.
3. **Mapa curricular**: por defecto, `Config.gs` → `MAPA_JSON_URL` apunta al
   JSON público de este repo, así que **no necesitas crear tu propio mapa**.
   - Si quieres mantener tu propio mapa, haz un *fork* del repo, edita
     `data/mapa-curricular.json` y apunta `MAPA_JSON_URL` a tu fork (público).
4. **Despliega** como Web App (*Implementar → Nueva implementación → Aplicación
   web*):
   - *Ejecutar como*: **Usuario que accede a la aplicación web**.
   - *Quién tiene acceso*: **tu dominio** (o "Cualquiera con el enlace" si lo
     quieres abrir).
5. Comparte **tu** URL con tu profesorado.

## Actualizaciones

Cuando haya mejoras en el repo:

1. Abre tu proyecto en Apps Script → **Pull** con el Assistant.
2. **Implementar → Gestionar implementaciones → editar → Nueva versión →
   Implementar** (misma URL).

Tu profesorado no toca nada: al usar tu URL, ya tienen lo último.

## Notas

- El mapa se sirve por HTTPS desde GitHub; tu instancia solo necesita poder
  hacer peticiones externas (ya está declarado en el manifiesto).
- Los datos de cada profe se crean en **su** Drive; tú no ves sus notas.
