// Valida que ~/.clasprc.json tenga el formato que espera clasp ANTES de
// llamar a `clasp push`, para dar un mensaje claro en vez del error críptico
// de Node que da clasp cuando no reconoce el formato (desajuste de versión
// entre el login local y CLASP_VERSION de este workflow).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const version = process.env.CLASP_VERSION || '(desconocida)';
const file = path.join(os.homedir(), '.clasprc.json');

let datos;
try {
  datos = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('El secreto CLASPRC_JSON no es JSON válido.');
  process.exit(1);
}

if (!datos || !datos.token || !datos.token.access_token) {
  console.error(
    'CLASPRC_JSON no tiene el formato esperado por clasp ' + version + '.\n' +
    'Suele pasar si el login se hizo con OTRA versión de clasp.\n' +
    'Solución: en local, ejecuta "npx @google/clasp@' + version + ' login", ' +
    'copia el ~/.clasprc.json resultante y actualiza el secreto CLASPRC_JSON en GitHub.'
  );
  process.exit(1);
}
