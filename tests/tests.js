#!/usr/bin/env node
/**
 * Tests de EvaluAnda. Se ejecutan con Node (sin dependencias):
 *
 *     node tests/tests.js
 *
 * Comprueban las tres piezas más delicadas del proyecto EXTRAYENDO el código
 * real de los ficheros fuente (no copias que puedan quedarse desfasadas):
 *
 *  1. MOTOR DE NOTAS: el cliente (cliente.html) y el servidor (Resumen.gs)
 *     calculan por duplicado ("espejo"). Aquí se puntúa la misma batería de
 *     casos con ambos y se exige que coincidan, además de contrastar valores
 *     esperados fijados a mano. Si alguien cambia una regla en un lado y
 *     olvida el otro, esto falla.
 *  2. CRIPTO: cifrar→descifrar recupera el texto, el tag detecta valores
 *     corruptos/manipulados, y el formato antiguo (enc:) se sigue leyendo.
 *  3. PROMOCIÓN: el remapeo de criterios entre niveles funciona con los
 *     códigos REALES del mapa curricular (si el formato de códigos cambiara,
 *     esto avisa antes que ningún profe).
 *
 * El workflow de despliegue los ejecuta antes de sincronizar con Apps Script.
 *
 * (Sin 'use strict' a propósito: el eval directo debe declarar las funciones
 * extraídas en este mismo scope, y el modo estricto lo impide.)
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');

var fallos = 0, pruebas = 0;
function ok(cond, msg) {
  pruebas++;
  if (!cond) { fallos++; console.error('  ✗ ' + msg); }
}
function aprox(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < 1e-9;
}

/** Código de una función (o un `var X = {...}`) por llaves balanceadas. */
function bloque(src, firma, conPuntoYComa) {
  var i = src.indexOf(firma);
  if (i < 0) throw new Error('No se encontró en el fuente: ' + firma);
  var j = src.indexOf('{', i), depth = 0;
  for (var k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') {
      depth--;
      if (!depth) return src.slice(i, k + 1) + (conPuntoYComa ? ';' : '');
    }
  }
  throw new Error('Llaves sin cerrar en: ' + firma);
}

// ════════════════════════════════════════════════════════════════════
// 1. MOTOR DE NOTAS (cliente ↔ servidor)
// ════════════════════════════════════════════════════════════════════
console.log('1. Motor de notas (cliente vs. servidor)');

var htm = fs.readFileSync(path.join(RAIZ, 'cliente.html'), 'utf8');
var cli = '';
htm.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, function (m, s) { cli += s; return m; });

// Cliente: catálogo de tipos + funciones de puntuación reales.
eval(bloque(cli, 'var TIPOS_ACT = {', true));
eval(bloque(cli, 'function tipoDe(act)'));
eval(bloque(cli, 'function notaDeValor_(act, v)'));
eval(bloque(cli, 'function rubMaxPts_(def)'));
eval(bloque(cli, 'function notaRubrica_(def, picks, filtro)'));

// Servidor: escalas + puntuación reales de Resumen.gs.
var srv = fs.readFileSync(path.join(RAIZ, 'Resumen.gs'), 'utf8');
eval(bloque(srv, 'var NOTAS_ESCALA = {', true));
eval(bloque(srv, 'function notaActividad_(items, rubricas, act, alId, cod)'));
eval(bloque(srv, 'function rubMax_(def)'));
eval(bloque(srv, 'function notaRub_(def, picks, filtro)'));
eval(bloque(srv, 'function notaRubricaCrit_(def, act, picks, cod)'));

var RUBRICA = {
  niveles: [{ etiqueta: 'Exc', valor: 4 }, { etiqueta: 'Bien', valor: 3 },
            { etiqueta: 'Suf', valor: 2 }, { etiqueta: 'Insuf', valor: 1 }],
  indicadores: [{ texto: 'A', peso: 40 }, { texto: 'B', peso: 30 },
                { texto: 'C', peso: 20 }, { texto: 'D', peso: 10 }]
};

/** Nota del SERVIDOR para (actividad, valor, criterio). */
function notaServidor(a, v, cod) {
  var items = {}; items[a.actividadId] = { al: v };
  return notaActividad_(items, { r1: RUBRICA }, a, 'al', cod);
}
/**
 * Nota del CLIENTE: espejo de notaActividadCrit (cliente.html) sin su estado
 * global; la puntuación de verdad la hacen las funciones extraídas arriba.
 */
function notaCliente(a, v, cod) {
  if (tipoDe(a) === 'rubrica') {
    if (v == null || typeof v !== 'object') return null;
    var mapa = a.rubMap || [];
    if (mapa.length) {
      return notaRubrica_(RUBRICA, v, function (i) { return (mapa[i] || '') === cod; });
    }
    return notaRubrica_(RUBRICA, v, null);
  }
  var x = v;
  if (x != null && typeof x === 'object') {
    x = (a.desglose && cod != null && x[cod] != null) ? x[cod] : null;
  }
  return notaDeValor_(a, x);
}

/** Un caso: mismo resultado en ambos lados y (si se da) el valor esperado. */
function caso(nombre, a, v, cod, esperado) {
  a = Object.assign({ actividadId: 'a1', criterios: ['C1'], numItems: 0 }, a);
  var c = notaCliente(a, v, cod), s = notaServidor(a, v, cod);
  ok(aprox(c, s), nombre + ': cliente=' + c + ' ≠ servidor=' + s);
  if (arguments.length >= 5) ok(aprox(c, esperado), nombre + ': da ' + c + ', esperado ' + esperado);
}

// items (proporción sobre numItems, con topes)
caso('items 7/10', { tipo: 'items', numItems: 10 }, 7, 'C1', 7);
caso('items 0/10', { tipo: 'items', numItems: 10 }, 0, 'C1', 0);
caso('items pasa del máximo', { tipo: 'items', numItems: 10 }, 12, 'C1', 10);
caso('items sin numItems', { tipo: 'items', numItems: 0 }, 5, 'C1', null);
caso('items vacío', { tipo: 'items', numItems: 10 }, null, 'C1', null);
caso('items con texto (obs. residual)', { tipo: 'items', numItems: 10 }, 'hola', 'C1', null);
caso('items con objeto residual (sin desglose)', { tipo: 'items', numItems: 10 }, { C1: 7 }, 'C1', null);
// nota directa (0-10 con topes)
caso('nota 8,5', { tipo: 'nota' }, 8.5, 'C1', 8.5);
caso('nota >10', { tipo: 'nota' }, 11, 'C1', 10);
caso('nota <0', { tipo: 'nota' }, -2, 'C1', 0);
// check
caso('check sí', { tipo: 'check' }, 1, 'C1', 10);
caso('check no', { tipo: 'check' }, 0, 'C1', 0);
// contador (proporción solo si tiene máximo)
caso('contador sin máximo', { tipo: 'contador', numItems: 0 }, 3, 'C1', null);
caso('contador 3/5', { tipo: 'contador', numItems: 5 }, 3, 'C1', 6);
// escalas (se guarda el Nº de nivel 1-5)
[2.5, 5, 6, 7.5, 9.5].forEach(function (n, i) {
  caso('escala nivel ' + (i + 1), { tipo: 'escala' }, i + 1, 'C1', n);
});
[2, 4, 6, 8, 10].forEach(function (n, i) {
  caso('escalaInf nivel ' + (i + 1), { tipo: 'escalaInf' }, i + 1, 'C1', n);
});
caso('escala nivel fuera de rango', { tipo: 'escala' }, 6, 'C1', null);
// observación: nunca puntúa
caso('texto nunca puntúa', { tipo: 'texto' }, 7, 'C1', null);
// desglose (objeto {criterio: valor}; cada criterio recibe SU valor)
var actD = { tipo: 'items', numItems: 10, desglose: true, criterios: ['C1', 'C2'] };
caso('desglose C1', actD, { C1: 7, C2: 3 }, 'C1', 7);
caso('desglose C2', actD, { C1: 7, C2: 3 }, 'C2', 3);
caso('desglose criterio sin valor', actD, { C1: 7 }, 'C2', null);
caso('desglose con nota única de antes', actD, 6, 'C1', 6);
// rúbrica (picks {índiceIndicador: nivel 1-based}; ponderada por pesos, /10)
var actR = { tipo: 'rubrica', rubricaId: 'r1', criterios: ['C1'], rubMap: [] };
caso('rúbrica todo al máximo', actR, { 0: 1, 1: 1, 2: 1, 3: 1 }, 'C1', 10);
caso('rúbrica todo al mínimo', actR, { 0: 4, 1: 4, 2: 4, 3: 4 }, 'C1', 2.5);
caso('rúbrica mixta ponderada', actR, { 0: 1, 1: 2, 2: 3, 3: 4 }, 'C1', 7.5);
caso('rúbrica parcial (solo A)', actR, { 0: 1 }, 'C1', 10);
caso('rúbrica sin evaluar', actR, {}, 'C1', null);
var actRM = { tipo: 'rubrica', rubricaId: 'r1', criterios: ['C1', 'C2'],
  rubMap: ['C1', 'C2', 'C1', 'C2'] };
caso('rúbrica por indicador (C1: A+C)', actRM, { 0: 1, 1: 1, 2: 3, 3: 1 }, 'C1',
  (4 / 4 * 40 + 2 / 4 * 20) / 60 * 10);
caso('rúbrica por indicador (C2: B+D)', actRM, { 0: 1, 1: 1, 2: 3, 3: 1 }, 'C2', 10);

// ════════════════════════════════════════════════════════════════════
// 2. CRIPTO (ida y vuelta, integridad y formato antiguo)
// ════════════════════════════════════════════════════════════════════
console.log('2. Cripto (cifrado de nombres)');

var crypto = require('crypto');
function aFirmados(buf) { return Array.from(buf).map(function (x) { return x > 127 ? x - 256 : x; }); }
var almacenProps = {}; // singleton: la clave debe persistir entre llamadas
global.Utilities = {
  base64Encode: function (x) { // Apps Script admite byte[] o cadena
    if (typeof x === 'string') return Buffer.from(x, 'utf8').toString('base64');
    return Buffer.from(x.map(function (b) { return b & 0xff; })).toString('base64');
  },
  base64Decode: function (s) { return aFirmados(Buffer.from(s, 'base64')); },
  computeHmacSha256Signature: function (msg, key) {
    return aFirmados(crypto.createHmac('sha256', key).update(msg, 'utf8').digest());
  },
  getUuid: function () { return crypto.randomUUID(); },
  newBlob: function (x) {
    if (typeof x === 'string') {
      return { getBytes: function () { return aFirmados(Buffer.from(x, 'utf8')); } };
    }
    return { getDataAsString: function () {
      return Buffer.from(x.map(function (b) { return b & 0xff; })).toString('utf8');
    } };
  }
};
global.PropertiesService = { getUserProperties: function () {
  return {
    getProperty: function (k) { return almacenProps[k] || null; },
    setProperty: function (k, v) { almacenProps[k] = v; }
  };
} };
global.Logger = { log: function () {} };

// Cripto es un módulo IIFE: se extrae desde su declaración hasta el })();
var criptoSrc = fs.readFileSync(path.join(RAIZ, 'Cripto.gs'), 'utf8');
var iniC = criptoSrc.indexOf('var Cripto');
eval(criptoSrc.slice(iniC, criptoSrc.indexOf('})();', iniC) + 5));

var nombres = ['García Pérez, Lucía', 'Ye, Xin Yi (Sofía)', 'Ñoño Ávila, José'];
nombres.forEach(function (n) {
  var enc = Cripto.cifrar(n);
  ok(enc.indexOf('enc2:') === 0, 'cifra al formato nuevo: ' + enc.slice(0, 8));
  ok(Cripto.descifrar(enc) === n, 'ida y vuelta de «' + n + '»');
});
// Dos cifrados del mismo nombre no coinciden (nonce por valor).
ok(Cripto.cifrar('Ana') !== Cripto.cifrar('Ana'), 'nonce por valor (cifrados distintos)');
// Un valor manipulado se detecta (no se devuelve basura silenciosa).
var enc = Cripto.cifrar('María');
var roto = enc.slice(0, -2) + (enc.slice(-2) === 'AA' ? 'BB' : 'AA');
ok(Cripto.descifrar(roto) === '(dato dañado)', 'tag detecta manipulación');
// El formato ANTIGUO (enc:<nonce>:<b64>, sin tag) se sigue leyendo.
var p = enc.split(':'); // enc2, nonce, tag, b64
ok(Cripto.descifrar('enc:' + p[1] + ':' + p[3]) === 'María', 'lee el formato antiguo');
// Texto plano y vacíos pasan tal cual.
ok(Cripto.descifrar('Pepe') === 'Pepe', 'texto plano intacto');
ok(Cripto.cifrar('') === '' && Cripto.cifrar(null) === null, 'vacíos intactos');

// ════════════════════════════════════════════════════════════════════
// 3. PROMOCIÓN (remapeo con los códigos reales del mapa curricular)
// ════════════════════════════════════════════════════════════════════
console.log('3. Promoción (remapeo de criterios con el mapa real)');

var pro = fs.readFileSync(path.join(RAIZ, 'Promocion.gs'), 'utf8');
eval(bloque(pro, 'function digitoNivel_(curso)'));
eval(bloque(pro, 'function remapearCriterios_(criterios, dOrigen, dDestino, validos)'));

var mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'mapa-curricular.json'), 'utf8'));
var porCurso = {};
mapa.forEach(function (c) { (porCurso[c.curso] || (porCurso[c.curso] = [])).push(c.codigo); });

var origen = '4º Primaria', destino = '5º Primaria';
if (porCurso[origen] && porCurso[destino]) {
  var dO = digitoNivel_(origen), dD = digitoNivel_(destino);
  ok(dO === '4' && dD === '5', 'dígito de nivel de "' + origen + '"/"' + destino + '"');
  // El formato que asume el remapeo (2º token = nivel) debe seguir vigente.
  var conPatron = porCurso[origen].filter(function (c) { return c.split('.')[1] === dO; });
  ok(conPatron.length / porCurso[origen].length > 0.9,
    'el 2º token de los códigos de ' + origen + ' es el nivel (¿cambió el formato del mapa?)');
  var validos = {};
  porCurso[destino].forEach(function (c) { validos[c] = true; });
  var remap = remapearCriterios_(conPatron, dO, dD, validos);
  ok(remap.length / conPatron.length > 0.8,
    'remapeo 4º→5º: solo ' + remap.length + '/' + conPatron.length + ' con equivalente');
  remap.forEach(function (c) {
    if (!validos[c]) { ok(false, 'remapeado a código inexistente: ' + c); }
  });
} else {
  ok(false, 'el mapa no trae ' + origen + ' o ' + destino);
}
// Infantil (sin dígito de nivel): el remapeo devuelve vacío, sin romperse.
ok(remapearCriterios_(['CA.02.1.1'], '', '5', {}).length === 0, 'Infantil → sin remapeo');

// ════════════════════════════════════════════════════════════════════
// 4. AGREGADO PONDERADO (FP: RA + pesos; sin pesos = media simple exacta)
// ════════════════════════════════════════════════════════════════════
console.log('4. Agregado ponderado (RA y pesos de FP)');

eval(bloque(srv, 'function agregadoPonderado_(notas, pesos)'));

// Sin pesos (Primaria): idéntico a la media simple, y sin RA en la salida.
var r1 = agregadoPonderado_({ a: 4, b: 6, c: 8 }, {});
ok(aprox(r1.final, 6), 'sin pesos → media simple (6)');
ok(Object.keys(r1.ras).length === 0, 'sin pesos → sin notas de RA');
ok(agregadoPonderado_({}, {}).final === null, 'sin notas → final null');

// FP: dos RA con pesos 30/70 y pesos de criterio dentro del RA1.
var pesosFP = {
  'RA1.a': { ra: 'RA1', pRA: 30, pCr: 20 },
  'RA1.b': { ra: 'RA1', pRA: 30, pCr: 80 },
  'RA2.a': { ra: 'RA2', pRA: 70, pCr: '' }
};
var r2 = agregadoPonderado_({ 'RA1.a': 10, 'RA1.b': 5, 'RA2.a': 8 }, pesosFP);
ok(aprox(r2.ras.RA1, (10 * 20 + 5 * 80) / 100), 'nota RA1 ponderada por criterio (6)');
ok(aprox(r2.ras.RA2, 8), 'nota RA2 (un criterio)');
ok(aprox(r2.final, (6 * 30 + 8 * 70) / 100), 'final ponderada por RA (7.4)');

// RA sin evaluar aún: se renormaliza sobre lo evaluado (proyección).
var r3 = agregadoPonderado_({ 'RA1.a': 10, 'RA1.b': 5 }, pesosFP);
ok(aprox(r3.final, 6), 'RA2 sin notas → renormaliza sobre RA1');

// RA sin pesos: media simple de criterios dentro del RA, y RA a peso 1.
var r4 = agregadoPonderado_(
  { x: 4, y: 8, z: 6 },
  { x: { ra: 'RA1', pRA: '', pCr: '' }, y: { ra: 'RA1', pRA: '', pCr: '' }, z: { ra: 'RA2', pRA: '', pCr: '' } });
ok(aprox(r4.ras.RA1, 6) && aprox(r4.final, 6), 'RA sin pesos → medias simples por grupo');

// Mixto: un criterio propio con RA + uno del mapa central (sin entrada en pesos).
var r5 = agregadoPonderado_({ 'RA1.a': 10, 'LCL.3.1': 4 }, { 'RA1.a': { ra: 'RA1', pRA: '', pCr: '' } });
ok(aprox(r5.final, 7), 'criterio sin RA cuenta como grupo propio');

// Nota acumulada: lo no evaluado cuenta 0 (y sin nada evaluado, no hay nota).
eval(bloque(srv, 'function notasAcumuladas_(notas, todosCods)'));
var ac = notasAcumuladas_({ a: 6 }, ['a', 'b', 'c']);
ok(aprox(agregadoPonderado_(ac, {}).final, 2), 'acumulada: 6 de 3 criterios → 2');
ok(agregadoPonderado_(notasAcumuladas_({}, ['a', 'b']), {}).final === null,
  'acumulada: sin nada evaluado → null');
var ac2 = notasAcumuladas_({ viejo: 8 }, ['a']); // criterio ya fuera del mapa
ok(aprox(agregadoPonderado_(ac2, {}).final, 4), 'acumulada: criterio borrado del mapa cuenta');

// ════════════════════════════════════════════════════════════════════
console.log('');
if (fallos) {
  console.error('✗ ' + fallos + ' de ' + pruebas + ' comprobaciones han fallado.');
  process.exit(1);
}
console.log('✓ ' + pruebas + ' comprobaciones, todas bien.');
