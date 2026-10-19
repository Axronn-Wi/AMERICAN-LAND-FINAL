const multer = require('multer');
const { almacenEnBD } = require('../utils/archivos');
const path = require('path');
const crypto = require('crypto');

const EXTENSIONES = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];

// Se guarda en la base de datos (ver src/utils/archivos.js), no en el disco
const storage = almacenEnBD(function (req, file) {
  // Nombre único y aleatorio: nunca se usa el nombre que manda el alumno
  const ext = path.extname(file.originalname).toLowerCase();
  const nombre = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext;
  return nombre;
});

function filtroArchivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EXTENSIONES.includes(ext)) return cb(null, true);
  cb(new Error('FORMATO_NO_PERMITIDO'));
}

const subirEntrega = multer({
  storage: storage,
  fileFilter: filtroArchivo,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
}).single('archivo'); // el campo del formulario se llamará "archivo"

// Envuelve a multer para responder JSON claro cuando algo falla
function recibirArchivo(req, res, next) {
  subirEntrega(req, res, function (err) {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ mensaje: 'El archivo supera los 10 MB.' });
    }
    if (err.message === 'FORMATO_NO_PERMITIDO') {
      return res.status(400).json({ mensaje: 'Formato no permitido. Usa PDF, DOC, DOCX, PPT o PPTX.' });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error al recibir el archivo.' });
  });
}

module.exports = { recibirArchivo };