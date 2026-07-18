/**
 * Publicación de las sesiones de una CLASE en un calendario de Google, para
 * compartir con las familias (Camino 1).
 *
 * - Un calendario secundario por clase, creado por la app (scope acotado
 *   calendar.app.created: la app SOLO toca los calendarios que ella crea, nunca
 *   los personales del profe).
 * - Sincronización UNIDIRECCIONAL: EvaluAnda manda; el calendario es un reflejo.
 * - Cada sesión con fecha → un evento con id determinista (idempotente: al
 *   resincronizar se actualiza, no se duplica; lo que ya no existe se borra).
 * - El calendario se hace público; se comparte por su enlace / .ics.
 *
 * Todo tras FLAGS.planner. Se usa la API REST de Calendar con el token OAuth del
 * propio profe (UrlFetch), para respetar el scope acotado.
 */

/** Sincroniza (crea/actualiza) el calendario de la clase y devuelve sus enlaces. */
function sincronizarClaseCalendar(evalId) {
  return CalSync.sincronizar_(abrirCuaderno_(), evalId);
}
/** Estado de publicación de todas las clases del curso activo (para la UI). */
function estadoCalendariosClases() {
  return CalSync.estado_(abrirCuaderno_());
}
/** Activa/desactiva la actualización automática (a las 14:00 y a las 02:00). */
function activarAutoCalSync(activar) {
  return CalSync.activarAuto_(!!activar);
}
/** ¿Está activada la actualización automática para este profe? */
function estadoAutoCalSync() {
  return CalSync.autoActivo_();
}
/** Tarea programada: resincroniza todos los calendarios publicados del profe. */
function autoCalSyncTick() {
  try { CalSync.sincronizarTodas_(abrirCuaderno_()); } catch (e) {}
}

var CalSync = (function () {

  var API = 'https://www.googleapis.com/calendar/v3';
  var TZ = 'Europe/Madrid';

  function hoja_(ss) { return ss.getSheetByName(HOJAS.CALSYNC); }

  function fetch_(method, path, payload) {
    var opt = {
      method: method, muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    };
    if (payload) opt.payload = JSON.stringify(payload);
    var resp = UrlFetchApp.fetch(API + path, opt);
    var body = resp.getContentText(), json = {};
    try { json = body ? JSON.parse(body) : {}; } catch (e) {}
    return { code: resp.getResponseCode(), json: json };
  }

  // --- vínculo clase → calendarId (pestaña _calsync) ---
  function calIdDe_(ss, evalId) {
    var datos = hoja_(ss).getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) if (datos[i][0] === evalId) return datos[i][1] || '';
    return '';
  }
  function guardarCalId_(ss, evalId, calId) {
    var sh = hoja_(ss);
    var fila = Datos.filaDeId_(sh, evalId);
    var vals = [evalId, calId, new Date().toISOString()];
    if (fila < 0) sh.appendRow(vals); else sh.getRange(fila, 1, 1, 3).setValues([vals]);
  }

  // --- datos de la clase (nombre visible + horario) ---
  function claseInfo_(ss, evalId) {
    var sh = ss.getSheetByName(HOJAS.EVALUACIONES);
    var fila = Datos.filaDeId_(sh, evalId);
    if (fila < 0) return null;
    var f = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];
    var nombre = f[6] || f[2] || 'Clase'; // nombre || area
    var grupo = '';
    if (f[1]) {
      var shC = ss.getSheetByName(HOJAS.CLASES);
      var fc = Datos.filaDeId_(shC, f[1]);
      if (fc > 0) grupo = shC.getRange(fc, 2).getValue() || '';
    }
    var horario = [];
    try { horario = JSON.parse(f[10] || '[]') || []; } catch (e) {}
    return { nombre: nombre, grupo: grupo, horario: horario,
      etiqueta: nombre + (grupo ? ' · ' + grupo : '') };
  }

  // --- crear (o reutilizar) el calendario público de la clase ---
  function asegurarCalendario_(ss, evalId, info) {
    var calId = calIdDe_(ss, evalId);
    if (calId) {
      // Verifica que sigue existiendo (el profe pudo borrarlo a mano).
      var chk = fetch_('get', '/calendars/' + encodeURIComponent(calId), null);
      if (chk.code < 300) return calId;
    }
    var r = fetch_('post', '/calendars', {
      summary: 'EvaluAnda · ' + info.etiqueta, timeZone: TZ,
      description: 'Sesiones de «' + info.etiqueta + '» publicadas desde EvaluAnda.'
    });
    if (r.code >= 300 || !r.json.id) throw new Error('No se pudo crear el calendario (' + r.code + ').');
    calId = r.json.id;
    // Público (cualquiera con el enlace puede ver).
    fetch_('post', '/calendars/' + encodeURIComponent(calId) + '/acl',
      { role: 'reader', scope: { type: 'default' } });
    guardarCalId_(ss, evalId, calId);
    return calId;
  }

  // --- id determinista del evento (idempotencia sin guardar eventIds) ---
  function eventId_(sesionId, evalId) {
    // Calendar exige [a-v0-9], 5-1024 chars: los ids del cuaderno ya son hex+_.
    return ('s' + sesionId + evalId).replace(/[^a-v0-9]/gi, '').toLowerCase().slice(0, 900);
  }

  function textoPlano_(html) {
    return String(html || '')
      .replace(/<li[^>]*>/gi, '\n• ').replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }
  function isoMasUno_(iso) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + 1);
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  function diaSem_(iso) { var p = iso.split('-'); return (new Date(+p[0], +p[1] - 1, +p[2]).getDay() + 6) % 7; }
  function horaEnDia_(horario, iso) {
    var dia = diaSem_(iso), h = '';
    (horario || []).forEach(function (x) { if (x.dia === dia && x.hora) h = x.hora; });
    return /^\d{2}:\d{2}$/.test(h) ? h : '';
  }
  function masUnaHora_(hhmm) {
    var p = hhmm.split(':'), hh = (+p[0] + 1) % 24;
    return ('0' + hh).slice(-2) + ':' + p[1];
  }

  function cuerpoEvento_(s, a, info) {
    var iso = a.fecha, hora = horaEnDia_(info.horario, iso);
    var desc = textoPlano_(s.descripcion);
    if ((s.criterios || []).length) desc += (desc ? '\n\n' : '') + 'Criterios: ' + s.criterios.join(', ');
    if (a.observaciones) desc += (desc ? '\n\n' : '') + 'Obs.: ' + a.observaciones;
    var ev = { id: eventId_(s.sesionId, a.evalId), summary: s.titulo || 'Sesión',
      description: desc, source: { title: 'EvaluAnda', url: 'https://evaluanda' } };
    if (hora) {
      ev.start = { dateTime: iso + 'T' + hora + ':00', timeZone: TZ };
      ev.end = { dateTime: iso + 'T' + masUnaHora_(hora) + ':00', timeZone: TZ };
    } else {
      ev.start = { date: iso };
      ev.end = { date: isoMasUno_(iso) };
    }
    return ev;
  }

  function volcar_(calId, ev) {
    var r = fetch_('post', '/calendars/' + encodeURIComponent(calId) + '/events', ev);
    if (r.code === 409) { // ya existía: actualizar
      r = fetch_('put', '/calendars/' + encodeURIComponent(calId) + '/events/' + ev.id, ev);
    }
    return r;
  }

  function sincronizar_(ss, evalId) {
    var info = claseInfo_(ss, evalId);
    if (!info) throw new Error('Clase no encontrada.');
    var calId = asegurarCalendario_(ss, evalId, info);

    // Eventos que DEBEN existir: sesiones de tipo clase con asignación a esta
    // clase y fecha.
    var esperados = {};
    Planner.listar_(ss).forEach(function (s) {
      if ((s.tipo || 'clase') !== 'clase') return;
      (s.asignaciones || []).forEach(function (a) {
        if (a.evalId !== evalId || !a.fecha) return;
        var ev = cuerpoEvento_(s, a, info);
        esperados[ev.id] = true;
        volcar_(calId, ev);
      });
    });

    // Borra los eventos que ya no correspondan a ninguna sesión (huérfanos).
    var lst = fetch_('get', '/calendars/' + encodeURIComponent(calId) +
      '/events?maxResults=2500&showDeleted=false', null);
    (lst.json.items || []).forEach(function (it) {
      if (it.id && !esperados[it.id]) {
        fetch_('delete', '/calendars/' + encodeURIComponent(calId) + '/events/' + it.id, null);
      }
    });

    return enlaces_(calId, Object.keys(esperados).length);
  }

  function enlaces_(calId, n) {
    var cid = Utilities.base64EncodeWebSafe(calId).replace(/=+$/, '');
    return {
      calendarId: calId, n: n,
      // Vista web del calendario (se abre sin cuenta; ideal para familias):
      verUrl: 'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId) + '&ctz=' + encodeURIComponent(TZ),
      // «Añadir a mi Google Calendar» (familias con cuenta Google):
      addUrl: 'https://calendar.google.com/calendar/r?cid=' + cid,
      // Suscripción por .ics (cualquier app de calendario):
      icalUrl: 'https://calendar.google.com/calendar/ical/' + encodeURIComponent(calId) + '/public/basic.ics'
    };
  }

  function estado_(ss) {
    var sh = hoja_(ss);
    var mapa = {};
    var datos = sh.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) if (datos[i][0]) mapa[datos[i][0]] = datos[i][1] || '';
    return mapa; // { evalId: calendarId }
  }

  // --- actualización automática (triggers programados del propio profe) ---
  var TICK = 'autoCalSyncTick';

  function triggersTick_() {
    return ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === TICK;
    });
  }
  function autoActivo_() { return triggersTick_().length > 0; }

  function activarAuto_(activar) {
    // Limpia los existentes (evita duplicados) y, si procede, crea 14:00 y 02:00.
    triggersTick_().forEach(function (t) { ScriptApp.deleteTrigger(t); });
    if (activar) {
      ScriptApp.newTrigger(TICK).timeBased().atHour(14).everyDays(1).create();
      ScriptApp.newTrigger(TICK).timeBased().atHour(2).everyDays(1).create();
    }
    return { activo: activar };
  }

  /** Resincroniza todas las clases ya publicadas (una a una, sin cortar por un fallo). */
  function sincronizarTodas_(ss) {
    var datos = hoja_(ss).getDataRange().getValues(), n = 0;
    for (var i = 1; i < datos.length; i++) {
      if (!datos[i][0]) continue;
      try { sincronizar_(ss, datos[i][0]); n++; } catch (e) {}
    }
    return { clases: n };
  }

  return { sincronizar_: sincronizar_, estado_: estado_,
    activarAuto_: activarAuto_, autoActivo_: autoActivo_, sincronizarTodas_: sincronizarTodas_ };
})();
