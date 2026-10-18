const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  obtenerResumen,
  obtenerNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, eliminarNotificacion,
  obtenerContactos, obtenerMensajes, enviarMensaje
} = require('../controllers/comunicaciones.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarId } = require('../middleware/validar.middleware');

// Máximo 30 mensajes de chat por minuto por usuario (frena el spam)
const limiteMensajes = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => 'u' + req.usuario.id_usuario,
  message: { mensaje: 'Estás enviando mensajes muy rápido. Espera un momento.' }
});

router.param('id', validarId);
router.use(verificarToken);

router.get('/resumen', obtenerResumen);

router.get('/notificaciones', obtenerNotificaciones);
router.put('/notificaciones/leidas', marcarTodasLeidas);
router.put('/notificaciones/:id/leida', marcarNotificacionLeida);
router.delete('/notificaciones/:id', eliminarNotificacion);

router.get('/chat/contactos', obtenerContactos);
router.get('/chat/:id/mensajes', obtenerMensajes);
router.post('/chat/:id/mensajes', limiteMensajes, enviarMensaje);

module.exports = router;
