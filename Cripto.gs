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
 * valores (se evita el problema del "two-time pad"). Formato:
 *     enc:<nonce>:<base64>
 * Un valor sin el prefijo "enc:" se trata como texto plano y se devuelve igual
 * (así los datos importados en claro se muestran bien hasta re-cifrarse).
 *
 * Nota: es seudonimización razonable (protege de la lectura del archivo), no
 * cifrado de extremo a extremo. Si se pierde la clave, los nombres cifrados no
 * se pueden recuperar (las notas sí: usan ids opacos).
 */
var Cripto = (function () {

  var PREFIJO = 'enc:';

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

  /** Cifra un texto. Devuelve "enc:<nonce>:<base64>" o el original si está vacío. */
  function cifrar(texto) {
    if (texto == null || texto === '') return texto;
    var nonce = Utilities.getUuid().replace(/-/g, '').slice(0, 16); // aleatorio por valor
    var bytes = Utilities.newBlob(String(texto)).getBytes(); // UTF-8 (signed)
    var ks = flujo_(bytes.length, nonce);
    var enc = [];
    for (var i = 0; i < bytes.length; i++) enc.push(aSigned_((bytes[i] & 0xff) ^ ks[i]));
    return PREFIJO + nonce + ':' + Utilities.base64Encode(enc);
  }

  /** Descifra. Si no lleva el prefijo, se asume texto plano y se devuelve igual. */
  function descifrar(dato) {
    if (dato == null || String(dato).indexOf(PREFIJO) !== 0) return dato;
    var cuerpo = String(dato).slice(PREFIJO.length);
    var sep = cuerpo.indexOf(':');
    if (sep < 0) return dato; // formato irreconocible: se devuelve tal cual
    var enc = Utilities.base64Decode(cuerpo.slice(sep + 1)); // signed
    var ks = flujo_(enc.length, cuerpo.slice(0, sep));
    var dec = [];
    for (var i = 0; i < enc.length; i++) dec.push(aSigned_((enc[i] & 0xff) ^ ks[i]));
    return Utilities.newBlob(dec).getDataAsString(); // UTF-8
  }

  return { cifrar: cifrar, descifrar: descifrar };
})();
