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
const CARPETA_PERFILES = path.join(UPLOADS_DIR, 'perfiles');
const CARPETA_MURO = path.join(UPLOADS_DIR, 'muro');

// Crear las carpetas si no existen
fs.mkdirSync(CARPETA_ENTREGAS, { recursive: true });
fs.mkdirSync(CARPETA_MATERIAL, { recursive: true });
fs.mkdirSync(CARPETA_PERFILES, { recursive: true });
fs.mkdirSync(CARPETA_MURO, { recursive: true });

module.exports = { CARPETA_ENTREGAS, CARPETA_MATERIAL, CARPETA_PERFILES, CARPETA_MURO };