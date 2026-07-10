/**
 * Cifrado "en reposo" de datos personales (nombres del alumnado).
 *
 * Objetivo (LOPD): que el cuaderno de Google Sheets NO contenga nombres
 * legibles. En la hoja se guarda texto cifrado (prefijo "enc:"); la app los
 * descifra solo para mostrarlos.
 *
 * La clave vive en las propiedades de usuario del proyecto (NO en la hoja), es
 * única por usuario y se genera la primera vez. Cifrado de flujo tipo CTR
 * usando HMAC-SHA256 como función pseudoaleatoria (disponible en Utilities).
 *
 * Cada valor lleva un "nonce" aleatorio propio, de modo que dos nombres iguales
 * NO producen el mismo cifrado y el flujo de clave nunca se reutiliza entre
 * valores (se evita el problema del "two-time pad"). Formato actual, con tag
 * de integridad (HMAC truncado del propio cifrado: una celda corrupta o
 * manipulada se detecta en vez de descifrar a basura silenciosa):
 *     enc2:<nonce>:<tag>:<base64>
 * Se siguen leyendo los valores del formato anterior sin tag
 * ("enc:<nonce>:<base64>"); al re-guardarse van pasando al formato nuevo.
 * Un valor sin prefijo "enc" se trata como texto plano y se devuelve igual
 * (así los datos importados en claro se muestran bien hasta re-cifrarse).
 *
 * Nota: es seudonimización razonable (protege de la lectura del archivo), no
 * cifrado de extremo a extremo. Si se pierde la clave, los nombres cifrados no
 * se pueden recuperar (las notas sí: usan ids opacos).
 */
var Cripto = (function () {

  var PREFIJO = 'enc:';    // formato antiguo (sin tag): solo se LEE
  var PREFIJO2 = 'enc2:';  // formato actual (con tag de integridad)

  function clave_() {
    var props = PropertiesService.getUserProperties();
    var k = props.getProperty('cifKey');
    if (!k) {
      k = Utilities.base64Encode(Utilities.getUuid() + ':' + Utilities.getUuid());
      props.setProperty('cifKey', k);
    }
    return k;
  }

  function aSigned_(x) { x = x & 0xff; return x > 127 ? x - 256 : x; }

  /** Genera n bytes (0..255) de flujo de clave: HMAC(key, nonce:contador). */
  function flujo_(n, nonce) {
    var key = clave_();
    var out = [], contador = 0;
    while (out.length < n) {
      var bloque = Utilities.computeHmacSha256Signature(nonce + ':' + contador, key);
      for (var i = 0; i < bloque.length && out.length < n; i++) out.push(bloque[i] & 0xff);
      contador++;
    }
    return out;
  }

  /**
   * Tag de integridad: HMAC del nonce + cifrado, con la misma clave pero
   * dominio separado ("mac:") para que nunca coincida con el flujo. Truncado
   * a 12 caracteres base64 (~9 bytes): sobra para detectar corrupción.
   */
  function tag_(nonce, b64) {
    var mac = Utilities.computeHmacSha256Signature('mac:' + nonce + ':' + b64, clave_());
    return Utilities.base64Encode(mac).slice(0, 12);
  }

  /** Cifra un texto. Devuelve "enc2:<nonce>:<tag>:<base64>" o el original si está vacío. */
  function cifrar(texto) {
    if (texto == null || texto === '') return texto;
    var nonce = Utilities.getUuid().replace(/-/g, '').slice(0, 16); // aleatorio por valor
    var bytes = Utilities.newBlob(String(texto)).getBytes(); // UTF-8 (signed)
    var ks = flujo_(bytes.length, nonce);
    var enc = [];
    for (var i = 0; i < bytes.length; i++) enc.push(aSigned_((bytes[i] & 0xff) ^ ks[i]));
    var b64 = Utilities.base64Encode(enc);
    return PREFIJO2 + nonce + ':' + tag_(nonce, b64) + ':' + b64;
  }

  /** XOR del cifrado con el flujo del nonce → texto (común a ambos formatos). */
  function abrir_(nonce, b64) {
    var enc = Utilities.base64Decode(b64); // signed
    var ks = flujo_(enc.length, nonce);
    var dec = [];
    for (var i = 0; i < enc.length; i++) dec.push(aSigned_((enc[i] & 0xff) ^ ks[i]));
    return Utilities.newBlob(dec).getDataAsString(); // UTF-8
  }

  /** Descifra ambos formatos. Sin prefijo = texto plano (se devuelve igual). */
  function descifrar(dato) {
    var s = String(dato == null ? '' : dato);
    if (dato == null) return dato;
    if (s.indexOf(PREFIJO2) === 0) { // formato actual: verifica el tag primero
      var p = s.slice(PREFIJO2.length).split(':');
      if (p.length !== 3) return dato;
      if (tag_(p[0], p[2]) !== p[1]) {
        Logger.log('Cripto: tag inválido (valor corrupto o manipulado)');
        return '(dato dañado)';
      }
      return abrir_(p[0], p[2]);
    }
    if (s.indexOf(PREFIJO) !== 0) return dato; // texto plano
    var cuerpo = s.slice(PREFIJO.length);      // formato antiguo, sin tag
    var sep = cuerpo.indexOf(':');
    if (sep < 0) return dato; // formato irreconocible: se devuelve tal cual
    return abrir_(cuerpo.slice(0, sep), cuerpo.slice(sep + 1));
  }

  return { cifrar: cifrar, descifrar: descifrar };
})();
