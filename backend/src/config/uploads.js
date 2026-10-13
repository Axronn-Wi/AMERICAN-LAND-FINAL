const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Carpeta raíz de los archivos subidos.
// Si existe la variable UPLOADS_DIR se usa esa; si no, backend/uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const CARPETA_ENTREGAS = path.join(UPLOADS_DIR, 'entregas');
const CARPETA_MATERIAL = path.join(UPLOADS_DIR, 'material');

// Crear las carpetas si no existen
fs.mkdirSync(CARPETA_ENTREGAS, { recursive: true });
fs.mkdirSync(CARPETA_MATERIAL, { recursive: true });

module.exports = { CARPETA_ENTREGAS, CARPETA_MATERIAL };