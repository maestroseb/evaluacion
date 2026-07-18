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
 * Todo tras FLAGS.planner. Se usa el SERVICIO AVANZADO de Calendar (no UrlFetch
 * a la API REST): con el proyecto GCP por defecto de Apps Script la API no se
 * puede habilitar a mano (403 «API has not been used in project»), mientras que
 * el servicio avanzado la habilita solo. Los scopes del manifiesto mandan, así
 * que se mantiene el acotado calendar.app.created.
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

  var TZ = 'Europe/Madrid';

  function hoja_(ss) { return ss.getSheetByName(HOJAS.CALSYNC); }

  /** Traduce los errores del servicio avanzado a mensajes accionables. */
  function motivo_(e) { return String((e && e.message) || e || ''); }
  function esPermisos_(e) { return /insufficient|scope|PERMISSION_DENIED/i.test(motivo_(e)); }

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
      // ¿Sigue existiendo? (el profe pudo borrarlo a mano).
      try { Calendar.Calendars.get(calId); } catch (e) { calId = ''; }
    }
    if (calId) {
      // Asegura que es público: un intento anterior pudo crearlo sin llegar
      // a compartirlo (p. ej. cuando faltaba el permiso de ACL).
      asegurarPublico_(calId);
      return calId;
    }
    var creado;
    try {
      creado = Calendar.Calendars.insert({
        summary: 'EvaluAnda · ' + info.etiqueta, timeZone: TZ,
        description: 'Sesiones de «' + info.etiqueta + '» publicadas desde EvaluAnda.'
      });
    } catch (e) {
      // Caso típico: la sesión se autorizó ANTES de que la app pidiera el
      // permiso de Calendario → re-autorizar.
      if (esPermisos_(e)) {
        throw new Error('Falta el permiso de Calendario: recarga la app y acepta ' +
          'la pantalla de permisos nueva (si no aparece, cierra sesión y vuelve a entrar).');
      }
      throw new Error('No se pudo crear el calendario: ' + motivo_(e));
    }
    calId = creado.id;
    guardarCalId_(ss, evalId, calId);
    asegurarPublico_(calId);
    return calId;
  }

  /**
   * Hace público el calendario (idempotente: reinsertar la misma regla no
   * duplica). En dominios educativos el administrador puede prohibirlo: se
   * avisa en vez de callar (el enlace no serviría fuera del dominio).
   */
  function asegurarPublico_(calId) {
    try {
      Calendar.Acl.insert({ role: 'reader', scope: { type: 'default' } }, calId);
    } catch (e) {
      throw new Error('Calendario creado, pero no se pudo hacer público ' +
        '(las familias fuera del dominio no lo verían). Motivo: ' + motivo_(e));
    }
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
    try { Calendar.Events.insert(ev, calId); }
    catch (e) { // ya existía (u otro conflicto): actualizar
      try { Calendar.Events.update(ev, calId, ev.id); } catch (e2) {}
    }
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
    try {
      var lst = Calendar.Events.list(calId, { maxResults: 2500, showDeleted: false });
      (lst.items || []).forEach(function (it) {
        if (it.id && !esperados[it.id]) {
          try { Calendar.Events.remove(calId, it.id); } catch (e) {}
        }
      });
    } catch (e) { /* la limpieza nunca rompe la publicación */ }

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
