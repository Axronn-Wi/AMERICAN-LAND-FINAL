const multer = require('multer');
const { almacenEnBD } = require('../utils/archivos');
const path = require('path');
const crypto = require('crypto');

const TIPOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Se guarda en la base de datos (ver src/utils/archivos.js), no en el disco
const storage = almacenEnBD(function (req, file) {
  // Nombre aleatorio con el id del usuario: nunca se usa el nombre original
  const nombre = 'u' + req.usuario.id_usuario + '-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + TIPOS[file.mimetype];
  return nombre;
});

function filtroFoto(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const extensionValida = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  if (TIPOS[file.mimetype] && extensionValida) return cb(null, true);
  cb(new Error('FORMATO_NO_PERMITIDO'));
}

const subirFoto = multer({
  storage: storage,
  fileFilter: filtroFoto,
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB (el navegador la reduce antes de enviarla)
}).single('foto');

// Envuelve a multer para responder JSON claro cuando algo falla
function recibirFoto(req, res, next) {
  subirFoto(req, res, function (err) {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ mensaje: 'La foto supera los 3 MB.' });
    }
    if (err.message === 'FORMATO_NO_PERMITIDO') {
      return res.status(400).json({ mensaje: 'Formato no permitido. Usa una imagen JPG, PNG o WEBP.' });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error al recibir la foto.' });
  });
}

module.exports = { recibirFoto };
