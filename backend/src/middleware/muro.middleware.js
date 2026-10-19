const multer = require('multer');
const { almacenEnBD } = require('../utils/archivos');
const path = require('path');
const crypto = require('crypto');

const TIPOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Se guarda en la base de datos (ver src/utils/archivos.js), no en el disco
const storage = almacenEnBD(function (req, file) {
  // Nombre aleatorio: nunca se usa el nombre original del archivo
  return 'p' + req.usuario.id_usuario + '-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + TIPOS[file.mimetype];
});

function filtroImagen(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (TIPOS[file.mimetype] && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(null, true);
  cb(new Error('FORMATO_NO_PERMITIDO'));
}

const subirImagen = multer({
  storage: storage,
  fileFilter: filtroImagen,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB (el navegador la reduce antes de enviarla)
}).single('imagen');

// Envuelve a multer para responder JSON claro cuando algo falla
function recibirImagenMuro(req, res, next) {
  subirImagen(req, res, function (err) {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ mensaje: 'La foto supera los 5 MB.' });
    }
    if (err.message === 'FORMATO_NO_PERMITIDO') {
      return res.status(400).json({ mensaje: 'Formato no permitido. Usa una imagen JPG, PNG o WEBP.' });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error al recibir la foto.' });
  });
}

module.exports = { recibirImagenMuro };
