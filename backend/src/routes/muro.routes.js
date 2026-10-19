const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken, sesionOpcional } = require('../middleware/auth.middleware');
const { recibirImagenMuro } = require('../middleware/muro.middleware');
const {
  listarPublicaciones, listarComentarios, verImagen,
  crearPublicacion, eliminarPublicacion, alternarMeGusta, comentar, eliminarComentario
} = require('../controllers/muro.controller');

router.param('id', validarId);

// Límites por usuario para evitar spam
function limitePorUsuario(minutos, maximo, mensaje) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => 'u' + req.usuario.id_usuario,
    message: { mensaje }
  });
}
const limitePublicar = limitePorUsuario(60, 10, 'Ya compartiste varias fotos. Espera un rato para publicar otra.');
const limiteComentar = limitePorUsuario(1, 15, 'Estás comentando muy rápido. Espera un momento.');

// Públicas: cualquier visitante ve el muro (con sesión se ve además "me gusta" propio)
router.get('/publicaciones', sesionOpcional, listarPublicaciones);
router.get('/publicaciones/:id/comentarios', sesionOpcional, listarComentarios);
router.get('/imagen/:id', verImagen);

// Con sesión: estudiantes, docentes, secretaría y admin
router.post('/publicaciones', verificarToken, limitePublicar, recibirImagenMuro, crearPublicacion);
router.delete('/publicaciones/:id', verificarToken, eliminarPublicacion);
router.post('/publicaciones/:id/me-gusta', verificarToken, alternarMeGusta);
router.post('/publicaciones/:id/comentarios', verificarToken, limiteComentar, comentar);
router.delete('/comentarios/:id', verificarToken, eliminarComentario);

module.exports = router;
